"""Core generation orchestrator (sync, self-contained).

Runs the agent pipeline -story analysis → design direction → outline → per-slide content,
layout, and image generation -persisting everything. Content and images are generated in
parallel (thread pool) for speed; DB writes happen on the main thread. Self-contained (opens
its own sync session) so it can be driven by a Celery worker or an inline call identically.
"""
from __future__ import annotations

import base64
import datetime
import random
import uuid
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy import delete, select

from app.ai.agents import content as content_agent
from app.ai.agents import design as design_agent
from app.ai.agents import image_prompt as image_prompt_agent
from app.ai.agents import layout as layout_agent
from app.ai.agents import outline as outline_agent
from app.ai.agents import quality_review as quality_review_agent
from app.ai.agents import story_analysis as story_agent
from app.ai import pptx_ref
from app.ai.images import generate_image
from app.ai.templates import recommend_template
from app.core.config import settings
from app.core.db import session_scope
from app.core.logging import get_logger
from app.core.storage import load_asset_bytes, store_asset
from app.models import Asset, Deck, GenerationJob, Project, Slide

log = get_logger("generation")

_EXT = {"image/svg+xml": "svg", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}
_MAX_WORKERS = 6
# Image providers rate-limit per minute — generate images at lower concurrency than text.
_IMG_WORKERS = 3

# slide_type → (content collection key, aspect ratio) for slides that render ONE image per
# element — a portrait per character, a frame per mood tile, a still per genre — instead of a
# single shared background. This is what turns placeholder card grids into real imagery.
_ITEM_IMAGE_COLLECTIONS = {
    "genre_blend": ("items", "3:4"),
    "character": ("characters", "3:4"),
    "supporting_characters": ("characters", "3:4"),
    "visual_aesthetic": ("moodBlocks", "1:1"),
}


# Phrases in the director's notes that mean "FOLLOW my reference template" rather than
# "take inspiration from it" — they switch generation to template-faithful (uniform) layout.
_MATCH_PHRASES = (
    "match exact", "follow this template", "follow the template", "follow it exactly",
    "same template", "same design exactly", "replicate", "mirror the reference",
    "copy the reference", "template-faithful", "exact same style",
)


def _wants_exact_match(intake: dict | None, design: dict | None = None) -> bool:
    """Did the director ask the deck to FOLLOW their reference exactly (vs inspiration)?

    Reads the intake notes the interview agent records (designDirection carries the stated
    usage intent) and the design agent's own layoutStyle verdict ('uniform, template-faithful').
    """
    text = " ".join(
        str((intake or {}).get(k) or "")
        for k in ("designDirection", "visualAesthetic", "visualReferences")
    ).lower()
    layout_style = str((design or {}).get("layoutStyle") or "").lower()
    return (any(p in text for p in _MATCH_PHRASES)
            or "template-faithful" in layout_style
            or ("uniform" in layout_style and "template" in layout_style))


def _element_prompt(slide_type, element, intake, design, has_references):
    """Pick the right per-element diffusion prompt for this slide's collection."""
    if slide_type in ("character", "supporting_characters"):
        return image_prompt_agent.build_character_prompt(element, intake, design, has_references)
    if slide_type == "visual_aesthetic":
        return image_prompt_agent.build_mood_prompt(element, intake, design, has_references)
    return image_prompt_agent.build_item_prompt(element, intake, design, has_references)


def _project_dict(project: Project) -> dict:
    return {
        "title": project.title,
        "genres": project.genres or [],
        "tone": project.tone or [],
        "language": project.language,
        "pitchPurpose": project.pitch_purpose,
        "storyStage": project.story_stage,
    }


def _load_reference_images(session, project_id, limit: int = 4) -> list[dict]:
    """The director's visual-direction references as [{"mediaType", "data": <base64>}].

    These are the images uploaded in the intake 'Choose Your Visual Direction' gallery, persisted
    as `upload_ref` assets tagged ``source=visual_direction`` (slide-replacement uploads share the
    `upload_ref` kind but a different source, so they're excluded). They condition slide image
    generation so the output actually resembles what the director referenced.
    """
    rows = session.execute(
        select(Asset).where(Asset.project_id == project_id, Asset.kind == "upload_ref")
    ).scalars().all()
    refs: list[dict] = []
    for asset in rows:
        meta = asset.generation_meta or {}
        if meta.get("source") != "visual_direction":
            continue
        data = load_asset_bytes(asset.storage_key, meta.get("stored_in_s3"))
        if not data:
            continue
        refs.append({
            "mediaType": asset.mime or "image/jpeg",
            "data": base64.b64encode(data).decode("ascii"),
        })
        if len(refs) >= limit:
            break
    return refs


def _set_job(session, job_id: str | None, *, status: str | None = None,
             progress: int | None = None, result: dict | None = None, error: str | None = None):
    if not job_id:
        return
    job = session.get(GenerationJob, uuid.UUID(job_id))
    if job is None:
        return
    if status is not None:
        job.status = status
        if status in ("succeeded", "failed"):
            job.finished_at = datetime.datetime.now(datetime.timezone.utc)
    if progress is not None:
        job.progress = max(0, min(100, progress))
    if result is not None:
        job.result = result
    if error is not None:
        job.error = error
    session.flush()


def _gen_image_resilient(prompt, aspect, palette, reference_images, seed=None):
    """generate_image, but if reference-conditioning (img2img) falls back to a placeholder, retry
    ONCE as plain text-to-image — so a slide/element still gets a REAL picture even when img2img
    fails (e.g. a 3:4 portrait against a wide reference image)."""
    img = generate_image(prompt, aspect_ratio=aspect, palette=palette,
                         reference_images=reference_images, seed=seed)
    if reference_images and img.meta.get("provider") == "placeholder":
        img = generate_image(prompt, aspect_ratio=aspect, palette=palette,
                             reference_images=None, seed=seed)
    return img


def _slide_seed(slide_type: str) -> int:
    """A STABLE but DISTINCT seed per slide type. When a thin brief makes every slide's prompt
    collapse to the same generic scene (e.g. a dark city skyline), a shared seed would render the
    SAME picture on every slide. A per-slide seed forces each frame's composition to differ."""
    return (abs(hash(slide_type)) % 2_000_000_000) + 1


def _generate_slide_image(slide_type: str, intake: dict, design: dict, content: dict | None = None,
                          reference_images: list[dict] | None = None):
    """Pure compute (no DB): build a story-grounded prompt + generate image bytes.

    ``reference_images`` are the director's visual references (base64). When present they both
    steer the prompt (match-the-references, don't force a dark look) and condition the image
    model directly so the rendered art resembles them."""
    prompt = image_prompt_agent.build_prompt(
        slide_type, intake, design, content, has_references=bool(reference_images)
    )
    img = _gen_image_resilient(prompt, image_prompt_agent.aspect_for(slide_type),
                               design.get("palette"), reference_images, seed=_slide_seed(slide_type))
    return prompt, img


def _persist_image(session, project_id, slide: Slide, prompt: str, img) -> None:
    """DB write: create the asset row, store bytes, bind the URL onto the slide content."""
    kind = image_prompt_agent.image_kind(slide.slide_type)
    ext = _EXT.get(img.mime, "png")
    key = f"generated/{project_id}/{kind}/{uuid.uuid4().hex}.{ext}"
    asset = Asset(
        project_id=project_id,
        slide_id=str(slide.id),
        kind=kind,
        storage_key=key,
        mime=img.mime,
        generation_meta={**img.meta},
    )
    session.add(asset)
    session.flush()
    stored = store_asset(key, img.data, img.mime)
    asset.generation_meta = {**(asset.generation_meta or {}), "stored_in_s3": stored.stored_in_s3}
    url = f"{settings.public_base_url}{settings.api_v1_prefix}/assets/{asset.id}"
    slide.image_asset_id = asset.id
    content = dict(slide.content or {})
    # Keep the image being replaced as a selectable option so a regenerate never loses it.
    old_url = content.get("imageUrl")
    cands = [u for u in (content.get("imageCandidates") or []) if isinstance(u, str)]
    if old_url and old_url != url and old_url not in cands:
        cands.append(old_url)
    if url not in cands:
        cands.append(url)
    content["imageCandidates"] = cands[-12:]
    content["imageUrl"] = url
    content["imagePrompt"] = prompt
    slide.content = content


def _store_slide_image(session, project_id, slide: Slide, intake: dict, design: dict) -> None:
    prompt, img = _generate_slide_image(slide.slide_type, intake, design, slide.content)
    _persist_image(session, project_id, slide, prompt, img)


def _store_item_asset(session, project_id, slide: Slide, img) -> Asset:
    """Store one generated grid-item image as an asset (not bound to slide.image_asset_id)."""
    ext = _EXT.get(img.mime, "png")
    key = f"generated/{project_id}/background/{uuid.uuid4().hex}.{ext}"
    asset = Asset(project_id=project_id, slide_id=str(slide.id), kind="background",
                  storage_key=key, mime=img.mime, generation_meta={**img.meta})
    session.add(asset)
    session.flush()
    stored = store_asset(key, img.data, img.mime)
    asset.generation_meta = {**(asset.generation_meta or {}), "stored_in_s3": stored.stored_in_s3}
    return asset


def _regenerate_item_images(session, slide: Slide, project, intake: dict, design: dict,
                            references, job_id: str | None) -> dict:
    """Generate ONE image per content item (e.g. each genre tile on the genre-blend slide) and
    bind it to that item as ``imageUrl`` — "three separate images for comedy/crime/drama". Images
    are produced in parallel (pure compute); the DB writes happen here on the main thread."""
    from app.services.deck_service import serialize_slide

    coll_key, aspect = _ITEM_IMAGE_COLLECTIONS.get(slide.slide_type, ("items", "3:4"))
    elements = [dict(e) if isinstance(e, dict) else e
                for e in ((slide.content or {}).get(coll_key) or [])]

    # Visual aesthetic: prefer REAL film references (TMDB stills); AI only fills tiles TMDB
    # couldn't match. Other collections (characters, genres) re-roll every element.
    if slide.slide_type == "visual_aesthetic":
        from app.ai.agents import content as content_agent
        elements = content_agent.attach_film_backdrops(elements)
        gen_idx = [i for i, el in enumerate(elements)
                   if isinstance(el, dict) and not el.get("imageUrl")]
    else:
        gen_idx = [i for i, el in enumerate(elements) if isinstance(el, dict)]

    def _one(i):  # pure compute — no DB
        prompt = _element_prompt(slide.slide_type, elements[i], intake, design, bool(references))
        img = _gen_image_resilient(prompt, aspect, design.get("palette"), references)
        return i, prompt, img

    made = 0
    if gen_idx:
        with ThreadPoolExecutor(max_workers=_IMG_WORKERS) as ex:
            for i, prompt, img in ex.map(_one, gen_idx):
                # Bind even a placeholder so the tile is never blank; count only REAL art in `made`.
                asset = _store_item_asset(session, project.id, slide, img)
                el = dict(elements[i])
                el["imageUrl"] = f"{settings.public_base_url}{settings.api_v1_prefix}/assets/{asset.id}"
                el["imagePrompt"] = prompt
                elements[i] = el
                if img.meta.get("provider") != "placeholder":
                    made += 1

    content = dict(slide.content or {})
    content[coll_key] = elements
    slide.content = content
    session.flush()
    have = sum(1 for el in elements if isinstance(el, dict) and el.get("imageUrl"))
    log.info("✓ %s images for %s slide %s — %d/%d have images (%d real)",
             coll_key, slide.slide_type, slide.id, have, len(elements), made)
    # `ok` reflects whether REAL art was produced — placeholders are bound so the slide isn't blank,
    # but the editor should still know the provider didn't deliver real images this time.
    result = {"slide": serialize_slide(slide), "ok": made > 0}
    if made == 0:
        result["reason"] = "image_provider_unavailable"
    _set_job(session, job_id, status="succeeded", progress=100, result=result)
    return result


def _generate_all_item_images(session, project_id, slides, intake: dict, design: dict,
                              references, limit: int | None = None) -> int:
    """One parallel pass over the whole deck: render an image for EVERY element of every
    per-element slide (character portraits, mood frames, genre stills) and bind them. Returns the
    count produced. Resilient — callers wrap it so a failure here never aborts the deck."""
    tasks = []  # (slide, coll_key, aspect, idx, element)
    for slide in slides:
        coll = _ITEM_IMAGE_COLLECTIONS.get(slide.slide_type)
        if not coll:
            continue
        key, aspect = coll
        elements = (slide.content or {}).get(key)
        if isinstance(elements, list):
            for idx, el in enumerate(elements[:8]):
                # Skip elements that ALREADY carry an image (e.g. a visual-aesthetic tile given a
                # real TMDB film backdrop) so the AI pass only fills genuine gaps, never overwrites.
                if isinstance(el, dict) and not el.get("imageUrl"):
                    tasks.append((slide, key, aspect, idx, el))
    if limit is not None and limit >= 0:
        tasks = tasks[:limit]
    if not tasks:
        return 0

    def _one(task):  # pure compute — no DB
        slide, key, aspect, idx, el = task
        prompt = _element_prompt(slide.slide_type, el, intake, design, bool(references))
        img = _gen_image_resilient(prompt, aspect, design.get("palette"), references)
        return task, prompt, img

    with ThreadPoolExecutor(max_workers=_IMG_WORKERS) as ex:
        results = list(ex.map(_one, tasks))

    # Apply per-slide so each slide.content (JSONB) is reassigned once. EVERY element gets bound —
    # a real image when generation succeeded, else the deterministic palette placeholder — so a
    # character / genre tile is NEVER left blank. `made` counts only REAL images (for logging).
    by_slide: dict = {}
    made = 0
    placeholders = 0
    ph_reason = ""
    for (slide, key, aspect, idx, el), prompt, img in results:
        if img.meta.get("provider") == "placeholder":
            placeholders += 1
            ph_reason = ph_reason or img.meta.get("reason") or "image provider returned a placeholder"
        else:
            made += 1
        asset = _store_item_asset(session, project_id, slide, img)
        url = f"{settings.public_base_url}{settings.api_v1_prefix}/assets/{asset.id}"
        slot = by_slide.setdefault(
            slide.id, {"slide": slide, "key": key,
                       "elements": [dict(e) if isinstance(e, dict) else e
                                    for e in ((slide.content or {}).get(key) or [])]}
        )
        if idx < len(slot["elements"]) and isinstance(slot["elements"][idx], dict):
            slot["elements"][idx]["imageUrl"] = url
            slot["elements"][idx]["imagePrompt"] = prompt
    for slot in by_slide.values():
        slide = slot["slide"]
        content = dict(slide.content or {})
        content[slot["key"]] = slot["elements"]
        slide.content = content
    session.flush()
    if placeholders:
        log.warning("per-element images: %d real, %d placeholder (provider issue: %s) — bound to "
                    "palette placeholders so tiles are not blank", made, placeholders, ph_reason)
    return made


def run_full_deck(project_id: str, template_id: str | None = None,
                  job_id: str | None = None, with_images: bool = True) -> dict:
    """Generate a complete deck for a project. Returns {deckId, slideCount}."""
    with session_scope() as session:
        try:
            _set_job(session, job_id, status="running", progress=2)
            project = session.get(Project, uuid.UUID(project_id))
            if project is None:
                raise ValueError("project not found")
            intake = project.intake_form or {}
            reference = project.reference_deck or None
            pdict = _project_dict(project)
            references = _load_reference_images(session, project.id)
            # References always inform the DESIGN (palette/typography). They condition the per-slide
            # IMAGES (img2img) only when explicitly enabled — otherwise every slide would copy the
            # same reference and look identical (and inherit its text). Default: text-to-image, so
            # each slide is a unique, text-free frame.
            image_refs = references if settings.build_images_from_references else None
            log.info("> Generating deck for %r (genres=%s tone=%s, %d ref image(s), img2img=%s, deck ref=%s)",
                     project.title, pdict["genres"], pdict["tone"], len(references),
                     bool(image_refs), (reference or {}).get("fileName"))

            # 1. Story analysis
            project.story_analysis = story_agent.run(pdict, intake)
            log.info("  -story analysis")
            _set_job(session, job_id, progress=8)

            # 2. Design direction — palette/typography/motifs driven by reference images when
            #    present, and additionally anchored to any uploaded reference deck.
            design = design_agent.run(pdict, intake, references, reference=reference)
            design_clean = {k: v for k, v in design.items() if k != "_register"}
            palette = [c.get("hex") for c in (design_clean.get("palette") or [])[:4]]
            log.info("  -design direction -register=%s palette=%s",
                     design.get("_register"), palette)
            _set_job(session, job_id, progress=14)

            # 3. Outline — brief-aware: honours deckLength, drops ungrounded slides,
            # adds grounded extras for longer decks (LLM with deterministic fallback).
            tpl = template_id or recommend_template(pdict["genres"], pdict["tone"])
            outline = outline_agent.run(pdict, intake, tpl, reference=reference)
            log.info("  -outline -template=%s, %d slides (deckLength=%r)",
                     tpl, len(outline), (intake or {}).get("deckLength") or "default")

            # 4. Replace any existing deck
            existing = session.execute(
                select(Deck).where(Deck.project_id == project.id)
            ).scalars().all()
            for d in existing:
                session.execute(delete(Slide).where(Slide.deck_id == d.id))
                session.delete(d)
            session.flush()
            deck = Deck(project_id=project.id, template_id=tpl, slide_count=len(outline),
                        status="content_pending", design_direction=design)
            session.add(deck)
            session.flush()

            # 5. Content for every slide -in parallel (LLM, no DB). When a reference deck
            # is set, ground each slide in its matching reference slide's framing.
            def _content(item):
                ref_slide = (pptx_ref.match_slide(item["title"], item["purpose"], reference)
                             if reference else None)
                return content_agent.run(item["slide_type"], item["title"], item["purpose"],
                                         intake, design_clean, reference_slide=ref_slide)

            with ThreadPoolExecutor(max_workers=_MAX_WORKERS) as ex:
                contents = list(ex.map(_content, outline))
            log.info("  -content -%d slides written", len(contents))
            _set_job(session, job_id, progress=45)

            # 6. Images for every slide -in parallel (diffusion, no DB)
            img_map: dict[int, tuple[str, object]] = {}
            if with_images:
                # Per-element slides (characters, moods, genres) get a real image PER element in a
                # later pass — exclude them here so we don't also spend a single shared background.
                targets = [(i, item) for i, item in enumerate(outline)
                           if image_prompt_agent.slide_needs_image(item["slide_type"])
                           and item["slide_type"] not in _ITEM_IMAGE_COLLECTIONS]
                targets = targets[: settings.max_deck_images]  # cap diffusion cost per deck

                def _img(pair):
                    i, item = pair
                    # contents[i] is THIS slide's generated copy → image grounded in the real slide.
                    return i, _generate_slide_image(
                        item["slide_type"], intake, design_clean, contents[i], image_refs
                    )

                # Image providers (esp. Vertex Imagen) rate-limit per minute — keep image
                # concurrency low so a full deck doesn't burst past the limit.
                with ThreadPoolExecutor(max_workers=_IMG_WORKERS) as ex:
                    img_map = dict(ex.map(_img, targets))
                providers = [res[1].meta.get("provider") for res in img_map.values()]
                real = sum(1 for p in providers if p in ("vertex", "google", "fal", "replicate"))
                log.info("  -images -%d generated (%d real, %d placeholder)",
                         len(img_map), real, len(img_map) - real)
            _set_job(session, job_id, progress=80)

            # 7. Persist slides + images (main thread / single session)
            # Whole-deck visual rhythm, seeded by this deck's id: every build paces
            # differently (per-film identity), while one build stays reproducible.
            # If the director asked to FOLLOW their reference exactly, switch to the
            # uniform, template-faithful scheme instead (consistent across all slides).
            exact = _wants_exact_match(intake, design_clean)
            appearances = layout_agent.plan_appearances(
                [it["slide_type"] for it in outline], design_clean,
                seed=str(deck.id), uniform=exact,
            )
            layout_rng = None if exact else random.Random(f"{deck.id}:layout")
            for i, item in enumerate(outline):
                slide = Slide(
                    deck_id=deck.id,
                    slide_number=item["slide_number"],
                    slide_type=item["slide_type"],
                    title=item["title"],
                    purpose=item["purpose"],
                    content=contents[i],
                    layout=layout_agent.run(item["slide_type"], design_clean,
                                            contents[i], has_image=i in img_map,
                                            rng=layout_rng),
                    # Initial visual rhythm — rendered via the appearance channel;
                    # the director can override it in the editor.
                    meta={"appearance": appearances[i]},
                    status="draft",
                )
                session.add(slide)
                session.flush()
                if i in img_map:
                    prompt, img = img_map[i]
                    _persist_image(session, project.id, slide, prompt, img)

            # 7b. Per-element imagery — a real image for each character / mood tile / genre so those
            # slides are real visuals, not placeholder grids. One parallel pass; non-fatal on error.
            if with_images:
                try:
                    persisted = session.execute(
                        select(Slide).where(Slide.deck_id == deck.id)
                    ).scalars().all()
                    n = _generate_all_item_images(
                        session, project.id, persisted, intake, design_clean, image_refs,
                        limit=max(0, settings.max_deck_images - len(img_map)))
                    log.info("  -per-element images -%d generated", n)
                except Exception as exc:  # noqa: BLE001
                    log.warning("per-element image pass failed (non-fatal): %s", exc)

            # 7c. Quality review — structural QA over the finished deck (non-fatal). Stored on the
            # deck so the editor/review screen can show the producer what to fix.
            try:
                review_slides = session.execute(
                    select(Slide).where(Slide.deck_id == deck.id)
                ).scalars().all()
                deck.quality_review = quality_review_agent.run(
                    [{"slideNumber": s.slide_number, "slideType": s.slide_type,
                      "title": s.title, "content": s.content or {}} for s in review_slides],
                    intake, design_clean,
                )
                log.info("  -quality review -score=%s, %d issue(s)",
                         deck.quality_review.get("score"),
                         len(deck.quality_review.get("issues") or []))
            except Exception as exc:  # noqa: BLE001
                log.warning("quality review failed (non-fatal): %s", exc)

            deck.status = "ready"
            project.status = "editor"
            project.last_edited_at = datetime.datetime.now(datetime.timezone.utc)
            session.flush()

            result = {"deckId": str(deck.id), "slideCount": deck.slide_count}
            log.info(">> Deck ready - %s (%d slides)", deck.id, deck.slide_count)
            _set_job(session, job_id, status="succeeded", progress=100, result=result)
            return result
        except Exception as exc:  # noqa: BLE001
            log.exception("[x] Deck generation failed: %s", exc)
            _set_job(session, job_id, status="failed", error=str(exc))
            raise


def prepare_deck(project_id: str, template_id: str | None = None,
                 job_id: str | None = None) -> dict:
    """Workshop step 1: story analysis + design + outline → EMPTY slides, no batch generation.

    Each slide is created as a pending shell carrying its purpose and a pre-seeded,
    EDITABLE image prompt in meta.prompts. The director then generates/refines each
    slide individually in the workshop before assembling the deck.
    """
    with session_scope() as session:
        try:
            _set_job(session, job_id, status="running", progress=5)
            project = session.get(Project, uuid.UUID(project_id))
            if project is None:
                raise ValueError("project not found")
            intake = project.intake_form or {}
            reference = project.reference_deck or None
            pdict = _project_dict(project)
            log.info("> Preparing workshop deck for %r (ref=%s)",
                     project.title, (reference or {}).get("fileName"))

            project.story_analysis = story_agent.run(pdict, intake)
            references = _load_reference_images(session, project.id)
            _set_job(session, job_id, progress=25)

            design = design_agent.run(pdict, intake, references, reference=reference)
            design_clean = {k: v for k, v in design.items() if k != "_register"}
            _set_job(session, job_id, progress=55)

            tpl = template_id or recommend_template(pdict["genres"], pdict["tone"])
            outline = outline_agent.run(pdict, intake, tpl, reference=reference)
            _set_job(session, job_id, progress=80)

            existing = session.execute(
                select(Deck).where(Deck.project_id == project.id)
            ).scalars().all()
            for d in existing:
                session.execute(delete(Slide).where(Slide.deck_id == d.id))
                session.delete(d)
            session.flush()
            deck = Deck(project_id=project.id, template_id=tpl, slide_count=len(outline),
                        status="workshop", design_direction=design)
            session.add(deck)
            session.flush()

            # Whole-deck visual rhythm, seeded by this deck's id (see plan_appearances).
            # Template-faithful (uniform) when the director asked to follow their reference.
            exact = _wants_exact_match(intake, design_clean)
            appearances = layout_agent.plan_appearances(
                [it["slide_type"] for it in outline], design_clean,
                seed=str(deck.id), uniform=exact,
            )
            layout_rng = None if exact else random.Random(f"{deck.id}:layout")
            for idx, item in enumerate(outline):
                # Cheap deterministic seed (no LLM) — replaced by a story-grounded prompt at
                # actual generation time; the director can also edit it in the workshop.
                seeded_prompt = image_prompt_agent.build_prompt(
                    item["slide_type"], intake, design_clean, use_llm=False
                ) if image_prompt_agent.slide_needs_image(item["slide_type"]) else ""
                slide = Slide(
                    deck_id=deck.id,
                    slide_number=item["slide_number"],
                    slide_type=item["slide_type"],
                    title=item["title"],
                    purpose=item["purpose"],
                    # Minimal shell so the preview renders something before generation.
                    content={"heading": item["title"]},
                    layout=layout_agent.run(item["slide_type"], design_clean, rng=layout_rng),
                    meta={
                        "appearance": appearances[idx],
                        "prompts": {"contentInstructions": "", "imagePrompt": seeded_prompt},
                        "generated": False,
                    },
                    status="draft",
                )
                session.add(slide)
            project.status = "content"  # deck-bearing: the studio now fetches the skeleton
            project.last_edited_at = datetime.datetime.now(datetime.timezone.utc)
            session.flush()
            result = {"deckId": str(deck.id), "slideCount": len(outline)}
            log.info(">> Workshop skeleton ready - %s (%d slides)", deck.id, len(outline))
            _set_job(session, job_id, status="succeeded", progress=100, result=result)
            return result
        except Exception as exc:  # noqa: BLE001
            log.exception("[x] Deck preparation failed: %s", exc)
            _set_job(session, job_id, status="failed", error=str(exc))
            raise


def run_story_analysis(project_id: str) -> dict:
    """Compute the Story Blueprint (StoryAnalysis) from the current intake and persist it on the
    project WITHOUT generating a deck — so the director can review the AI's understanding of the
    film (theme, genre DNA, world, commercial angle) before building (Design Bible step 3)."""
    with session_scope() as session:
        project = session.get(Project, uuid.UUID(project_id))
        if project is None:
            raise ValueError("project not found")
        analysis = story_agent.run(_project_dict(project), project.intake_form or {})
        project.story_analysis = analysis
        project.last_edited_at = datetime.datetime.now(datetime.timezone.utc)
        session.flush()
        log.info("✓ story blueprint computed for %r", project.title)
        return analysis


def run_design(project_id: str, job_id: str | None = None) -> dict:
    with session_scope() as session:
        project = session.get(Project, uuid.UUID(project_id))
        if project is None:
            raise ValueError("project not found")
        references = _load_reference_images(session, project.id)
        design = design_agent.run(_project_dict(project), project.intake_form or {}, references)
        design_clean = {k: v for k, v in design.items() if k != "_register"}
        deck = session.execute(
            select(Deck).where(Deck.project_id == project.id).limit(1)
        ).scalar_one_or_none()
        if deck:
            deck.design_direction = design
            session.flush()
        log.info("✓ design regenerated for %r", project.title)
        _set_job(session, job_id, status="succeeded", progress=100, result={"design": design_clean})
        return design_clean


def regenerate_slide(slide_id: str, job_id: str | None = None, with_image: bool = True,
                     instructions: str | None = None, image_prompt: str | None = None,
                     content_prompt: str | None = None, image_instruction: str | None = None,
                     reference_image: dict | None = None) -> dict:
    """(Re)generate one slide. Workshop parameters (all editable in the UI):
    ``instructions`` — director's notes the content agent must follow for this slide;
    ``image_prompt`` — an edited diffusion prompt, used verbatim instead of the built one;
    ``content_prompt`` — the FULL writer prompt, edited in the workshop, used verbatim;
    ``image_instruction`` — a change folded into the built image prompt ("add guns and roses");
    ``reference_image`` — {mediaType, data} used as an extra img2img style reference.
    """
    with session_scope() as session:
        slide = session.get(Slide, uuid.UUID(slide_id))
        if slide is None:
            raise ValueError("slide not found")
        deck = session.get(Deck, slide.deck_id)
        project = session.get(Project, deck.project_id)
        intake = project.intake_form or {}
        design = {k: v for k, v in (deck.design_direction or {}).items() if k != "_register"}
        # Persisted intake references drive img2img only when explicitly enabled — otherwise every
        # regenerate would copy the same reference (identical-looking + text-laden frames). A
        # per-call reference (deck-edit "make this slide look like this image") is ALWAYS honoured.
        references = (_load_reference_images(session, project.id)
                      if settings.build_images_from_references else [])
        if reference_image and reference_image.get("data"):
            references = [{"mediaType": reference_image.get("mediaType", "image/jpeg"),
                           "data": reference_image["data"]}, *references][:4]
        reference = project.reference_deck or None
        ref_slide = (pptx_ref.match_slide(slide.title or "", slide.purpose or "", reference)
                     if reference else None)

        # Preserve the user's manual editor state across a regenerate: inline text
        # overrides, free-form text boxes, and the existing image (so a failed image
        # generation never wipes good art).
        old = dict(slide.content or {})
        # A plain "regenerate this slide" (no verbatim edited prompt) is a request for a genuinely
        # NEW take — fresh copy + a rotated layout + new art — not a re-run of the cached version.
        is_full_regen = not (content_prompt and content_prompt.strip())
        new_content = content_agent.run(
            slide.slide_type, slide.title or "", slide.purpose or "", intake, design,
            instructions=instructions, raw_prompt=content_prompt, reference_slide=ref_slide,
            fresh=is_full_regen,
        )
        for key in ("edits", "textBoxes", "imageUrl", "imagePrompt"):
            if old.get(key) is not None:
                new_content[key] = old[key]
        slide.content = new_content
        will_have_image = with_image and image_prompt_agent.slide_needs_image(slide.slide_type)
        slide.layout = layout_agent.run(slide.slide_type, design,
                                        slide.content, has_image=will_have_image)
        slide.status = "draft"
        session.flush()

        used_image_prompt = ""
        coll = _ITEM_IMAGE_COLLECTIONS.get(slide.slide_type)
        has_elements = bool(
            coll and isinstance((slide.content or {}).get(coll[0]), list)
            and (slide.content or {}).get(coll[0])
        )
        if with_image and has_elements:
            # Per-element slides (character portraits, genre tiles, mood frames) get a real image
            # PER element — one portrait per character, one still per genre — NOT a single shared
            # background. The workshop path only ran the single-background branch before, which is
            # why these slides came out blank; mirror run_full_deck's per-element pass here.
            try:
                n = _generate_all_item_images(session, project.id, [slide], intake, design, references)
                log.info("  -%d per-element image(s) for %s slide %s", n, slide.slide_type, slide.id)
            except Exception as exc:  # noqa: BLE001
                log.warning("per-element image gen failed for slide %s (non-fatal): %s", slide.id, exc)
            session.flush()
        elif with_image and image_prompt_agent.slide_needs_image(slide.slide_type):
            # An edited prompt from the workshop wins over the auto-built one.
            used_image_prompt = (image_prompt or "").strip() or image_prompt_agent.build_prompt(
                slide.slide_type, intake, design, slide.content, has_references=bool(references)
            )
            # A chat instruction ("add realistic guns and roses") leads the prompt so the change
            # is reflected in the regenerated art.
            if image_instruction and image_instruction.strip():
                used_image_prompt = f"{image_instruction.strip()}. {used_image_prompt}"
            img = generate_image(
                used_image_prompt,
                aspect_ratio=image_prompt_agent.aspect_for(slide.slide_type),
                palette=design.get("palette"),
                reference_images=references,
                # A fresh random seed on a full regenerate so the art comes back visibly different.
                seed=random.randint(1, 2_000_000_000) if is_full_regen else None,
            )
            had_image = bool((slide.content or {}).get("imageUrl"))
            if img.meta.get("provider") == "placeholder" and had_image:
                # Provider unavailable (e.g. quota/429) — keep the existing image.
                log.warning(
                    "image regen fell back to placeholder; keeping existing image for slide %s",
                    slide.id,
                )
            else:
                _persist_image(session, project.id, slide, used_image_prompt, img)
            session.flush()

        # Record what was used so the workshop can show + re-edit it next time.
        meta = dict(slide.meta or {})
        meta["prompts"] = {
            **(meta.get("prompts") or {}),
            "contentInstructions": instructions or "",
            **({"contentPrompt": content_prompt.strip()} if content_prompt and content_prompt.strip() else {}),
            **({"imagePrompt": used_image_prompt} if used_image_prompt else {}),
        }
        meta["generated"] = True
        # A full "Regenerate slide" (or one carrying a fresh-take instruction) also changes the
        # LAYOUT — rotate the composition / image side / style pacing to a genuinely new look.
        if is_full_regen or (instructions and instructions.strip()):
            meta["appearance"] = layout_agent.varied_appearance(
                slide.slide_type, design, meta.get("appearance")
            )
        slide.meta = meta
        session.flush()

        log.info("✓ regenerated slide %s (%s)", slide.id, slide.slide_type)
        from app.services.deck_service import serialize_slide
        result = serialize_slide(slide)
        _set_job(session, job_id, status="succeeded", progress=100, result=result)
        return result


def regenerate_slide_image(slide_id: str, job_id: str | None = None,
                           prompt: str | None = None) -> dict:
    """Regenerate ONLY the slide image (text/content/edits untouched).

    ``prompt``: an edited diffusion prompt from the workshop — used verbatim when given;
    otherwise the prompt is rebuilt from intake + design.
    Returns {slide, ok, reason}. On provider failure (e.g. quota/429 → placeholder)
    the existing image is kept and ok=False so the UI can tell the user.
    """
    from app.services.deck_service import serialize_slide

    with session_scope() as session:
        try:
            _set_job(session, job_id, status="running", progress=10)
            slide = session.get(Slide, uuid.UUID(slide_id))
            if slide is None:
                raise ValueError("slide not found")
            deck = session.get(Deck, slide.deck_id)
            project = session.get(Project, deck.project_id)
            intake = project.intake_form or {}
            design = {k: v for k, v in (deck.design_direction or {}).items() if k != "_register"}
            references = _load_reference_images(session, project.id)

            # Per-element slides (genre tiles, character portraits, mood frames): render ONE image
            # PER element rather than a single shared background — this is what makes "give each
            # genre/character its own image" work through the existing generate-image action.
            coll = _ITEM_IMAGE_COLLECTIONS.get(slide.slide_type)
            if coll and isinstance((slide.content or {}).get(coll[0]), list) and (slide.content or {}).get(coll[0]):
                return _regenerate_item_images(
                    session, slide, project, intake, design, references, job_id
                )

            if not image_prompt_agent.slide_needs_image(slide.slide_type):
                result = {"slide": serialize_slide(slide), "ok": False, "reason": "slide_has_no_image"}
                _set_job(session, job_id, status="succeeded", progress=100, result=result)
                return result

            use_prompt = (prompt or "").strip()
            if use_prompt:
                img = generate_image(
                    use_prompt,
                    aspect_ratio=image_prompt_agent.aspect_for(slide.slide_type),
                    palette=design.get("palette"),
                    reference_images=references,
                )
            else:
                use_prompt, img = _generate_slide_image(
                    slide.slide_type, intake, design, slide.content, references
                )
            if img.meta.get("provider") == "placeholder":
                log.warning("image regen unavailable (placeholder) for slide %s", slide.id)
                result = {
                    "slide": serialize_slide(slide),
                    "ok": False,
                    "reason": "image_provider_unavailable",
                }
                _set_job(session, job_id, status="succeeded", progress=100, result=result)
                return result
            _persist_image(session, project.id, slide, use_prompt, img)
            # Remember the prompt that made this image so the workshop can re-edit it.
            meta = dict(slide.meta or {})
            meta["prompts"] = {**(meta.get("prompts") or {}), "imagePrompt": use_prompt}
            slide.meta = meta
            session.flush()
            log.info("✓ regenerated image for slide %s (%s)", slide.id, slide.slide_type)
            result = {"slide": serialize_slide(slide), "ok": True}
            _set_job(session, job_id, status="succeeded", progress=100, result=result)
            return result
        except Exception as exc:  # noqa: BLE001
            log.exception("[x] Slide image regeneration failed: %s", exc)
            _set_job(session, job_id, status="failed", error=str(exc))
            raise


def generate_project_image(project_id: str, slide_type: str) -> dict:
    """Generate a standalone image for a slide TYPE using the project's intake + design.

    Used by editor-added (client-only) slides that have no DB row. Returns {ok, url, reason}.
    The asset is stored unbound (slide_id=None); the frontend keeps the URL in slide content.
    """
    with session_scope() as session:
        project = session.get(Project, uuid.UUID(project_id))
        if project is None:
            raise ValueError("project not found")
        if not image_prompt_agent.slide_needs_image(slide_type):
            return {"ok": False, "reason": "slide_has_no_image"}

        deck = session.execute(
            select(Deck).where(Deck.project_id == project.id).limit(1)
        ).scalar_one_or_none()
        intake = project.intake_form or {}
        design = {k: v for k, v in ((deck.design_direction if deck else {}) or {}).items()
                  if k != "_register"}
        references = _load_reference_images(session, project.id)

        prompt, img = _generate_slide_image(slide_type, intake, design,
                                            reference_images=references)
        if img.meta.get("provider") == "placeholder":
            return {"ok": False, "reason": "image_provider_unavailable"}

        kind = image_prompt_agent.image_kind(slide_type)
        ext = _EXT.get(img.mime, "png")
        key = f"generated/{project.id}/{kind}/{uuid.uuid4().hex}.{ext}"
        asset = Asset(project_id=project.id, slide_id=None, kind=kind,
                      storage_key=key, mime=img.mime, generation_meta={**img.meta})
        session.add(asset)
        session.flush()
        stored = store_asset(key, img.data, img.mime)
        asset.generation_meta = {**(asset.generation_meta or {}),
                                 "stored_in_s3": stored.stored_in_s3}
        url = f"{settings.public_base_url}{settings.api_v1_prefix}/assets/{asset.id}"
        log.info("✓ generated standalone image (%s) for project %s", slide_type, project.id)
        return {"ok": True, "url": url}


def generate_slide_image_variants(slide_id: str, job_id: str | None = None,
                                  prompt: str | None = None, n: int = 3) -> dict:
    """Generate N image options for a slide so the director can pick one in the gallery.

    Stores all candidates on the slide as ``content.imageCandidates`` (and sets imageUrl to
    the first when the slide has none). Returns {slide, urls, ok, reason}.
    """
    from app.services.deck_service import serialize_slide

    with session_scope() as session:
        try:
            _set_job(session, job_id, status="running", progress=10)
            slide = session.get(Slide, uuid.UUID(slide_id))
            if slide is None:
                raise ValueError("slide not found")
            deck = session.get(Deck, slide.deck_id)
            project = session.get(Project, deck.project_id)
            intake = project.intake_form or {}
            design = {k: v for k, v in (deck.design_direction or {}).items() if k != "_register"}

            if not image_prompt_agent.slide_needs_image(slide.slide_type):
                result = {"slide": serialize_slide(slide), "urls": [], "ok": False,
                          "reason": "slide_has_no_image"}
                _set_job(session, job_id, status="succeeded", progress=100, result=result)
                return result

            use_prompt = (prompt or "").strip() or image_prompt_agent.build_prompt(
                slide.slide_type, intake, design)
            kind = image_prompt_agent.image_kind(slide.slide_type)
            aspect = image_prompt_agent.aspect_for(slide.slide_type)

            urls: list[str] = []
            for _ in range(max(1, min(n, 6))):
                img = generate_image(use_prompt, aspect_ratio=aspect, palette=design.get("palette"))
                if img.meta.get("provider") == "placeholder":
                    continue
                ext = _EXT.get(img.mime, "png")
                key = f"generated/{project.id}/{kind}/{uuid.uuid4().hex}.{ext}"
                asset = Asset(project_id=project.id, slide_id=str(slide.id), kind=kind,
                              storage_key=key, mime=img.mime, generation_meta={**img.meta})
                session.add(asset)
                session.flush()
                stored = store_asset(key, img.data, img.mime)
                asset.generation_meta = {**(asset.generation_meta or {}),
                                         "stored_in_s3": stored.stored_in_s3}
                urls.append(f"{settings.public_base_url}{settings.api_v1_prefix}/assets/{asset.id}")

            if not urls:
                result = {"slide": serialize_slide(slide), "urls": [], "ok": False,
                          "reason": "image_provider_unavailable"}
                _set_job(session, job_id, status="succeeded", progress=100, result=result)
                return result

            content = dict(slide.content or {})
            # ACCUMULATE so the gallery keeps earlier options — append new ones (deduped), cap 12.
            existing = [u for u in (content.get("imageCandidates") or []) if isinstance(u, str)]
            content["imageCandidates"] = (existing + [u for u in urls if u not in existing])[-12:]
            content["imagePrompt"] = use_prompt
            if not content.get("imageUrl"):
                content["imageUrl"] = urls[0]
            slide.content = content
            session.flush()
            log.info("✓ generated %d image options for slide %s", len(urls), slide.id)
            result = {"slide": serialize_slide(slide), "urls": urls, "ok": True}
            _set_job(session, job_id, status="succeeded", progress=100, result=result)
            return result
        except Exception as exc:  # noqa: BLE001
            log.exception("[x] Slide image variants failed: %s", exc)
            _set_job(session, job_id, status="failed", error=str(exc))
            raise
