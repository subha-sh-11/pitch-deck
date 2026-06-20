"""Core generation orchestrator (sync, self-contained).

Runs the agent pipeline -story analysis → design direction → outline → per-slide content,
layout, and image generation -persisting everything. Content and images are generated in
parallel (thread pool) for speed; DB writes happen on the main thread. Self-contained (opens
its own sync session) so it can be driven by a Celery worker or an inline call identically.
"""
from __future__ import annotations

import datetime
import uuid
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy import delete, select

from app.ai.agents import content as content_agent
from app.ai.agents import design as design_agent
from app.ai.agents import image_prompt as image_prompt_agent
from app.ai.agents import layout as layout_agent
from app.ai.agents import outline as outline_agent
from app.ai.agents import story_analysis as story_agent
from app.ai import pptx_ref
from app.ai.images import generate_image
from app.ai.templates import recommend_template
from app.core.config import settings
from app.core.db import session_scope
from app.core.logging import get_logger
from app.core.storage import store_asset
from app.models import Asset, Deck, GenerationJob, Project, Slide

log = get_logger("generation")

_EXT = {"image/svg+xml": "svg", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}
_MAX_WORKERS = 6
# Image providers rate-limit per minute — generate images at lower concurrency than text.
_IMG_WORKERS = 3


def _project_dict(project: Project) -> dict:
    return {
        "title": project.title,
        "genres": project.genres or [],
        "tone": project.tone or [],
        "language": project.language,
        "pitchPurpose": project.pitch_purpose,
        "storyStage": project.story_stage,
    }


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


def _generate_slide_image(slide_type: str, intake: dict, design: dict):
    """Pure compute (no DB): build prompt + generate image bytes."""
    prompt = image_prompt_agent.build_prompt(slide_type, intake, design)
    img = generate_image(
        prompt,
        aspect_ratio=image_prompt_agent.aspect_for(slide_type),
        palette=design.get("palette"),
    )
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
    content["imageUrl"] = url
    content["imagePrompt"] = prompt
    slide.content = content


def _store_slide_image(session, project_id, slide: Slide, intake: dict, design: dict) -> None:
    prompt, img = _generate_slide_image(slide.slide_type, intake, design)
    _persist_image(session, project_id, slide, prompt, img)


# Character slides show one card per lead — generate a portrait for each primary character.
_MAX_PORTRAITS = 4


def _store_character_portraits(session, project_id, slide: Slide, intake: dict, design: dict) -> int:
    """Generate a cinematic portrait per primary character and bind it to that character's
    imageUrl. Caps to the primary cast and skips placeholder results (the card then falls
    back to its gradient). Returns how many real portraits were attached."""
    content = dict(slide.content or {})
    characters = [c for c in (content.get("characters") or []) if isinstance(c, dict)]
    if not characters:
        return 0
    primary = characters[:_MAX_PORTRAITS]
    attached = 0
    for char in primary:
        if char.get("imageUrl"):
            attached += 1
            continue
        prompt = image_prompt_agent.build_character_prompt(char, intake, design)
        img = generate_image(prompt, aspect_ratio=image_prompt_agent.character_aspect(),
                             palette=design.get("palette"))
        if img.meta.get("provider") == "placeholder":
            continue
        ext = _EXT.get(img.mime, "png")
        key = f"generated/{project_id}/character_art/{uuid.uuid4().hex}.{ext}"
        asset = Asset(project_id=project_id, slide_id=str(slide.id), kind="character_art",
                      storage_key=key, mime=img.mime, generation_meta={**img.meta})
        session.add(asset)
        session.flush()
        stored = store_asset(key, img.data, img.mime)
        asset.generation_meta = {**(asset.generation_meta or {}), "stored_in_s3": stored.stored_in_s3}
        char["imageUrl"] = f"{settings.public_base_url}{settings.api_v1_prefix}/assets/{asset.id}"
        attached += 1
    # Keep only the primary cast on the slide (the director asked for primaries only).
    content["characters"] = primary
    slide.content = content
    return attached


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
            log.info("> Generating deck for %r (genres=%s tone=%s ref=%s)",
                     project.title, pdict["genres"], pdict["tone"],
                     (reference or {}).get("fileName"))

            # 1. Story analysis
            project.story_analysis = story_agent.run(pdict, intake)
            log.info("  -story analysis")
            _set_job(session, job_id, progress=8)

            # 2. Design direction (palette from genre/tone, anchored to any reference deck)
            design = design_agent.run(pdict, intake, reference=reference)
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
                targets = [(i, item) for i, item in enumerate(outline)
                           if image_prompt_agent.slide_needs_image(item["slide_type"])]

                def _img(pair):
                    i, item = pair
                    return i, _generate_slide_image(item["slide_type"], intake, design_clean)

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
            for i, item in enumerate(outline):
                slide = Slide(
                    deck_id=deck.id,
                    slide_number=item["slide_number"],
                    slide_type=item["slide_type"],
                    title=item["title"],
                    purpose=item["purpose"],
                    content=contents[i],
                    layout=layout_agent.run(item["slide_type"], design_clean,
                                            contents[i], has_image=i in img_map),
                    # Initial visual rhythm (bold/minimal/standard) — rendered via the
                    # appearance channel; the director can override it in the editor.
                    meta={"appearance": layout_agent.appearance_for(item["slide_type"], design_clean)},
                    status="draft",
                )
                session.add(slide)
                session.flush()
                if i in img_map:
                    prompt, img = img_map[i]
                    _persist_image(session, project.id, slide, prompt, img)
                if with_images and item["slide_type"] in ("character", "supporting_characters"):
                    n = _store_character_portraits(session, project.id, slide, intake, design_clean)
                    if n:
                        log.info("  -%d character portraits for slide %s", n, slide.slide_number)

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
            _set_job(session, job_id, progress=25)

            design = design_agent.run(pdict, intake, reference=reference)
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

            for item in outline:
                seeded_prompt = image_prompt_agent.build_prompt(
                    item["slide_type"], intake, design_clean
                ) if image_prompt_agent.slide_needs_image(item["slide_type"]) else ""
                slide = Slide(
                    deck_id=deck.id,
                    slide_number=item["slide_number"],
                    slide_type=item["slide_type"],
                    title=item["title"],
                    purpose=item["purpose"],
                    # Minimal shell so the preview renders something before generation.
                    content={"heading": item["title"]},
                    layout=layout_agent.run(item["slide_type"], design_clean),
                    meta={
                        "appearance": layout_agent.appearance_for(item["slide_type"], design_clean),
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


def run_design(project_id: str, job_id: str | None = None) -> dict:
    with session_scope() as session:
        project = session.get(Project, uuid.UUID(project_id))
        if project is None:
            raise ValueError("project not found")
        design = design_agent.run(_project_dict(project), project.intake_form or {})
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
                     content_prompt: str | None = None) -> dict:
    """(Re)generate one slide. Workshop parameters (all editable in the UI):
    ``instructions`` — director's notes the content agent must follow for this slide;
    ``image_prompt`` — an edited diffusion prompt, used verbatim instead of the built one;
    ``content_prompt`` — the FULL writer prompt, edited in the workshop, used verbatim.
    """
    with session_scope() as session:
        slide = session.get(Slide, uuid.UUID(slide_id))
        if slide is None:
            raise ValueError("slide not found")
        deck = session.get(Deck, slide.deck_id)
        project = session.get(Project, deck.project_id)
        intake = project.intake_form or {}
        design = {k: v for k, v in (deck.design_direction or {}).items() if k != "_register"}
        reference = project.reference_deck or None
        ref_slide = (pptx_ref.match_slide(slide.title or "", slide.purpose or "", reference)
                     if reference else None)

        # Preserve the user's manual editor state across a regenerate: inline text
        # overrides, free-form text boxes, and the existing image (so a failed image
        # generation never wipes good art).
        old = dict(slide.content or {})
        new_content = content_agent.run(
            slide.slide_type, slide.title or "", slide.purpose or "", intake, design,
            instructions=instructions, raw_prompt=content_prompt, reference_slide=ref_slide,
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
        if with_image and image_prompt_agent.slide_needs_image(slide.slide_type):
            # An edited prompt from the workshop wins over the auto-built one.
            used_image_prompt = (image_prompt or "").strip() or image_prompt_agent.build_prompt(
                slide.slide_type, intake, design
            )
            img = generate_image(
                used_image_prompt,
                aspect_ratio=image_prompt_agent.aspect_for(slide.slide_type),
                palette=design.get("palette"),
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

        # Character slides: give each primary character its own portrait.
        if with_image and slide.slide_type in ("character", "supporting_characters"):
            n = _store_character_portraits(session, project.id, slide, intake, design)
            log.info("✓ %d character portraits for slide %s", n, slide.id)
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
                )
            else:
                use_prompt, img = _generate_slide_image(slide.slide_type, intake, design)
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

        prompt, img = _generate_slide_image(slide_type, intake, design)
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
            content["imageCandidates"] = urls
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
