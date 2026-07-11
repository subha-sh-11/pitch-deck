"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { SlideRenderer } from "@/components/slides/SlideRenderer";
import { SlideThumbnailPreview } from "@/components/slides/SlideThumbnailPreview";
import { DeckExportButtons } from "@/features/export/DeckExportButtons";
import { useSetupWizard } from "@/features/setup/SetupWizardContext";
import { pollJob, workshopSlideImage } from "@/lib/api/generation";
import { uploadSlideImage } from "@/lib/api/projects";
import { buildSlideFromOutline } from "@/lib/build-slides";
import { FALLBACK_DESIGN } from "@/lib/deck-themes";
import { FONT_OPTIONS, loadFont, type FontOption } from "@/lib/fonts";
import { useSmoothProgress } from "@/lib/use-smooth-progress";
import type { DesignDirection } from "@/types/design";
import type { Slide, SlideType, SlideVersion } from "@/types/slide";
import type { Interview } from "./useInterview";
import { useWorkshopOptional } from "./workshop";

// The "presentation tab". Before Build it shows a live sketch from the brief; the moment the
// director hits Build deck, real generation streams the actual slides in here — same page, no
// intermediate routes (Cloud-Design style).
const OUTLINE: { slideType: SlideType; title: string }[] = [
  { slideType: "cover", title: "Cover" },
  { slideType: "logline", title: "Logline" },
  { slideType: "synopsis", title: "Synopsis" },
  { slideType: "character", title: "Characters" },
  { slideType: "visual_aesthetic", title: "Visual Aesthetic" },
];

// Slide types that carry a generated image (mirrors backend IMAGE_SLIDES). Used to show a
// per-slide "generating art" spinner only on slides that are actually waiting on an image —
// so text-only slides (contact, etc.) never show a stuck loader.
const IMAGE_SLIDE_TYPES = new Set<SlideType>([
  "cover", "logline", "genre_blend", "synopsis", "story_world", "character",
  "supporting_characters", "usp", "show_cross", "visual_aesthetic", "target_audience",
  "market_potential",
]);

/** True while the deck build is running and this slide hasn't received its image yet. */
function isSlideGenerating(slide: Slide, generating: boolean): boolean {
  return generating && IMAGE_SLIDE_TYPES.has(slide.slideType) && !slide.content.imageUrl;
}

// Fonts grouped by genre for the <optgroup> picker.
const FONT_GROUPS = FONT_OPTIONS.reduce<Record<string, FontOption[]>>((acc, f) => {
  (acc[f.genre] ??= []).push(f);
  return acc;
}, {});

/** Current deck accent hex for the colour input's initial value. */
function deckAccent(design: DesignDirection): string {
  const hex = design.palette?.find((c) => (c.usage ?? "").toLowerCase().includes("accent"))?.hex;
  return hex ?? "#22d3ee";
}

const DOT_BG: CSSProperties = {
  backgroundColor: "rgb(10 10 12)",
  backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)",
  backgroundSize: "22px 22px",
};

export function DeckCanvas({ iv }: { iv: Interview }) {
  const form = iv.form;
  const real = iv.draftSlides;
  const generating = iv.generationStatus === "generating";
  const buildProgress = useSmoothProgress(iv.generationProgress, generating);

  // The deck's live design — driven by the agent (e.g. "make it blue") and applied to every
  // slide instantly via CSS vars. useInterview folds any agent override into iv.designDirection.
  const effectiveDesign = iv.designDirection ?? FALLBACK_DESIGN;

  const hasContent = Boolean(
    (form.title || "").trim() || (form.logline || "").trim() || (form.synopsis || "").trim(),
  );
  const sketch = useMemo(
    () => OUTLINE.map((o, i) => buildSlideFromOutline({ ...o, purpose: "" }, form, i + 1, `canvas-${o.slideType}`)),
    [form],
  );

  // 1 ── Real generated deck (after Build): Canva-style stage — big selected slide up top,
  // filmstrip to navigate at the bottom, image rail on the right.
  if (real.length > 0) {
    return (
      <DeckStage
        slides={real}
        design={effectiveDesign}
        generating={generating}
        buildProgress={buildProgress}
      />
    );
  }

  // 2 ── Generation kicked off but no slides yet: progress state.
  if (generating) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 px-8 text-center" style={DOT_BG}>
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent-neon/30 border-t-accent-neon" />
        <div>
          <p className="font-display text-2xl text-text-primary">Building your deck…</p>
          <p className="mt-1 text-sm text-text-muted">Drafting story, copy, and cinematic art. This can take up to a minute.</p>
        </div>
        <div className="h-1.5 w-64 overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-accent-neon transition-[width] duration-500"
            style={{ width: `${buildProgress}%` }}
          />
        </div>
      </div>
    );
  }

  // 3 ── Pre-build: live sketch from the brief, or empty state.
  return (
    <div className="relative h-full overflow-y-auto" style={DOT_BG}>
      {!hasContent ? (
        <div className="relative flex h-full flex-col items-center justify-center overflow-hidden px-8 text-center">
          <div className="intake-halo pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full" />
          <div className="animate-intake-fade-in relative flex max-w-sm flex-col items-center gap-3">
            <SketchIcon />
            <p className="font-display text-3xl text-text-primary">Your deck will appear here</p>
            <p className="text-sm leading-relaxed text-text-muted">
              Describe your film on the left or fill the brief. When you hit{" "}
              <span className="text-text-primary">Build deck</span>, the real slides generate right here.
            </p>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
          {sketch.map((s, i) => (
            <figure key={s.id} className="group">
              <figcaption className="mb-1.5 flex items-center gap-2 text-[11px] uppercase tracking-wider text-text-dim">
                <span className="flex h-4 w-4 items-center justify-center rounded bg-surface-3 text-[9px] text-text-muted">
                  {i + 1}
                </span>
                {s.title}
              </figcaption>
              <div className="overflow-hidden rounded-xl border border-border-glass shadow-2xl shadow-black/40 ring-1 ring-white/5 transition-transform group-hover:-translate-y-0.5">
                <SlideThumbnailPreview slide={s} designDirection={effectiveDesign} />
              </div>
            </figure>
          ))}
          <div className="h-4" />
        </div>
      )}
    </div>
  );
}

// Canva-style presentation editor: large selected slide, filmstrip navigator, image rail.
function DeckStage({
  slides,
  design,
  generating,
  buildProgress,
}: {
  slides: Slide[];
  design: DesignDirection;
  generating: boolean;
  buildProgress: number;
}) {
  const {
    projectId, updateDraftSlide, replaceDraftSlide, applyAccent, applyDisplayFont, undo, canUndo,
    insertDraftSlideAfter, duplicateDraftSlide, deleteDraftSlide, removedSlides, restoreSlide,
  } = useSetupWizard();
  const [binOpen, setBinOpen] = useState(false);

  // After an add/duplicate the slides array grows on the next render; remember which index to
  // select so the new slide opens automatically once it lands.
  const pendingSelectRef = useRef<number | null>(null);

  // Ctrl/Cmd+Z undoes the last deck edit — unless the user is mid-typing in a text field, where
  // the browser's own text undo should win.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        const t = e.target as HTMLElement | null;
        if (t && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  // Set the deck's display font: load the webfont (if not bundled) then apply it deck-wide.
  const setDeckFont = (value: string) => {
    loadFont(value);
    applyDisplayFont(value);
  };
  // Ensure the current (possibly custom / persisted) deck font is loaded so it renders on open.
  useEffect(() => {
    loadFont(design.fonts?.display);
  }, [design.fonts?.display]);

  const [selectedId, setSelectedId] = useState<string>(slides[0]?.id ?? "");
  const [busy, setBusy] = useState<null | "import" | "generate">(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = slides.find((s) => s.id === selectedId) ?? slides[0];
  const curIndex = Math.max(0, slides.findIndex((s) => s.id === selectedId));

  // Select the freshly added/duplicated slide once it appears in the list.
  useEffect(() => {
    if (pendingSelectRef.current != null) {
      const s = slides[pendingSelectRef.current];
      if (s) setSelectedId(s.id);
      pendingSelectRef.current = null;
    }
  }, [slides]);

  // Keep the selection valid. A newly inserted slide starts with a temporary local id that the
  // backend later swaps for a real id — which would leave selectedId pointing at a slide that no
  // longer exists (nothing highlighted, view snaps to slide 1). When that happens, re-select the
  // slide now occupying the same position. Also clamps after a deletion.
  const lastIndexRef = useRef(0);
  useEffect(() => {
    const idx = slides.findIndex((s) => s.id === selectedId);
    if (idx >= 0) {
      lastIndexRef.current = idx;
    } else if (slides.length > 0) {
      const clamped = Math.min(lastIndexRef.current, slides.length - 1);
      setSelectedId(slides[clamped].id);
    }
  }, [slides, selectedId]);

  // Add a blank "Custom Slide" after the current one, or duplicate the current slide. Both open the
  // new slide automatically.
  const addSlideAfter = () => {
    insertDraftSlideAfter(curIndex, "generic");
    pendingSelectRef.current = curIndex + 1;
  };
  const duplicateCurrent = () => {
    duplicateDraftSlide(curIndex);
    pendingSelectRef.current = curIndex + 1;
  };

  // Step to the previous / next slide, clamped to the deck bounds.
  const goTo = (delta: number) => {
    const next = slides[Math.min(slides.length - 1, Math.max(0, curIndex + delta))];
    if (next) setSelectedId(next.id);
  };

  // Keep the shared workshop "current slide" in sync with the slide open here, so the chat agent
  // targets THE SLIDE THE DIRECTOR IS LOOKING AT ("this slide") instead of defaulting to slide 1.
  const setWorkshopIndex = useWorkshopOptional()?.setIndex;
  useEffect(() => {
    const idx = slides.findIndex((s) => s.id === selectedId);
    if (idx >= 0) setWorkshopIndex?.(idx);
  }, [selectedId, slides, setWorkshopIndex]);

  // Arrow keys navigate slides — but not while typing/editing text on a slide.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const idx = slides.findIndex((s) => s.id === selectedId);
      const next = slides[Math.min(slides.length - 1, Math.max(0, idx + (e.key === "ArrowRight" ? 1 : -1)))];
      if (next) setSelectedId(next.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, slides]);

  // Every image available for this slide: its generated options + the current one.
  const images = (() => {
    const c = (selected?.content.imageCandidates ?? []).filter(Boolean);
    const url = selected?.content.imageUrl;
    if (!c.length) return url ? [url] : [];
    return url && !c.includes(url) ? [url, ...c] : c;
  })();

  const versions = selected?.content.versions ?? [];

  // Snapshot the slide's CURRENT state into its history before a change replaces it, so any
  // earlier version (text + image) can be restored. Newest kept last; capped so it can't grow
  // without bound. `versions` itself is stripped from the snapshot to avoid nesting.
  const snapshot = (s: Slide, label: string) => {
    const { versions: _drop, ...content } = s.content;
    const prev = s.content.versions ?? [];
    const entry: SlideVersion = { ts: Date.now(), label, imageUrl: s.content.imageUrl, content };
    updateDraftSlide(s.id, { versions: [...prev, entry].slice(-20) });
  };

  const restoreVersion = (v: SlideVersion) => {
    if (!selected) return;
    // Keep current history (plus a snapshot of NOW) so restore is itself undoable.
    snapshot(selected, "before restore");

    const keep = selected.content.versions ?? [];
    updateDraftSlide(selected.id, { ...v.content, versions: keep });
  };

  // Click a thumbnail: set it on the slide. Click the CURRENT one again: unselect it — but KEEP it
  // in the gallery (add to candidates) so deselecting never makes the image disappear from the rail.
  const useImage = (u: string) => {
    if (!selected) return;
    const isCurrent = u === selected.content.imageUrl;
    snapshot(selected, isCurrent ? "unselect image" : "image change");
    const cands = selected.content.imageCandidates ?? [];
    updateDraftSlide(selected.id, {
      imageUrl: isCurrent ? undefined : u,
      imageCandidates: cands.includes(u) ? cands : [...cands, u],
    });
  };

  // Remove an image from the slide's gallery entirely (and clear it off the slide if it was current).
  const removeImage = (u: string) => {
    if (!selected) return;
    snapshot(selected, "remove image");
    const nextCandidates = (selected.content.imageCandidates ?? []).filter((c) => c !== u);
    updateDraftSlide(selected.id, {
      imageCandidates: nextCandidates,
      ...(selected.content.imageUrl === u ? { imageUrl: undefined } : {}),
    });
  };

  const importImage = async (file: File) => {
    if (!selected) return;
    setBusy("import");
    try {
      const url = await uploadSlideImage(projectId, file);
      snapshot(selected, "image import");
      // Keep the uploaded image in the gallery so it persists (doesn't "go off") after switching.
      const existing = selected.content.imageCandidates ?? [];
      updateDraftSlide(selected.id, {
        imageUrl: url,
        imageCandidates: existing.includes(url) ? existing : [...existing, url],
      });
    } catch {
      /* ignore */
    } finally {
      setBusy(null);
    }
  };

  const generateImage = async () => {
    if (!selected) return;
    setBusy("generate");
    try {
      const job = await workshopSlideImage(selected.id);
      const final = await pollJob(job);
      const res = final.result as { slide?: Slide } | undefined;
      if (res?.slide?.id) {
        snapshot(selected, "before regenerate");
        // Carry the (now updated) history onto the fresh slide so it isn't lost on replace.
        const history = (slides.find((s) => s.id === selected.id)?.content.versions) ?? [];
        replaceDraftSlide({
          ...res.slide,
          content: { ...res.slide.content, versions: history },
        });
      }
    } catch {
      /* ignore */
    } finally {
      setBusy(null);
    }
  };

  // Image actions wired into the slide itself, so the on-slide "Replace image" / per-card image
  // controls actually upload + regenerate (previously they were dead — no handlers were passed).
  const imageActions = {
    upload: (file: File) => uploadSlideImage(projectId, file),
    regenerate: async () => {
      if (!selected) return null;
      const job = await workshopSlideImage(selected.id);
      const final = await pollJob(job);
      const res = final.result as { slide?: Slide } | undefined;
      return res?.slide?.content.imageUrl ?? null;
    },
  };

  return (
    <div className="flex h-full min-h-0" style={DOT_BG}>
      {/* Centre column — top bar, big slide, filmstrip */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-border-glass bg-black/50 px-6 py-2 backdrop-blur">
          <span className="shrink-0 text-xs text-text-dim">
            {generating ? `Building your deck… ${buildProgress}%` : `Deck ready · ${slides.length} slides`}
          </span>

          {/* Deck-wide editing toolbar — font + accent apply live to every slide. Per-element
              edits (text, size, colour, move, duplicate) happen directly on the slide below. */}
          {!generating && (
            <div className="mx-auto flex min-w-0 items-center justify-center gap-2 overflow-x-auto">
              <span className="shrink-0 text-[10px] uppercase tracking-wider text-accent-neon/70">Whole deck ·</span>
              <div className="flex items-center gap-1.5 rounded-lg border border-border-glass bg-surface-1/50 px-2 py-1">
                <span className="text-[10px] uppercase tracking-wider text-text-dim">Font</span>
                <select
                  value={design.fonts?.display ?? ""}
                  onChange={(e) => setDeckFont(e.target.value)}
                  className="max-w-[150px] bg-transparent text-xs text-text-primary outline-none"
                  title="Deck display font — grouped by genre"
                >
                  {Object.entries(FONT_GROUPS).map(([genre, fonts]) => (
                    <optgroup key={genre} label={genre} className="bg-surface-1">
                      {fonts.map((f) => (
                        <option key={f.value} value={f.value} className="bg-surface-1 text-text-primary">
                          {f.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              {/* Import any Google font by name → loads + applies it. */}
              <button
                type="button"
                onClick={() => {
                  const name = window.prompt(
                    "Import a font by its Google Fonts name (e.g. \"Rubik Glitch\", \"Lobster\", \"Cinzel Decorative\"):",
                  )?.trim();
                  if (name) setDeckFont(name);
                }}
                title="Import a custom font by name (any Google font)"
                className="shrink-0 rounded-lg border border-border-glass bg-surface-1/50 px-2 py-1 text-[10px] uppercase tracking-wider text-text-dim transition-colors hover:text-text-primary"
              >
                ＋ Import font
              </button>
              <label
                className="flex items-center gap-1.5 rounded-lg border border-border-glass bg-surface-1/50 px-2 py-1 text-[10px] uppercase tracking-wider text-text-dim"
                title="Deck accent colour"
              >
                Accent
                <input
                  type="color"
                  defaultValue={deckAccent(design)}
                  onChange={(e) => applyAccent(e.target.value)}
                  className="h-4 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
                />
              </label>
              <span className="hidden text-[10px] text-text-dim lg:inline">
                Per-slide: click text to select (top toolbar: size / colour / blur / duplicate) · drag to move · drag a card to reposition · ＋ Text to add
              </span>
            </div>
          )}

          {!generating && (
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={addSlideAfter}
                title="Add a new blank slide after this one"
                className="rounded-lg border border-border-glass px-2 py-1 text-xs text-text-muted transition-colors hover:text-text-primary"
              >
                ＋ Slide
              </button>
              <button
                type="button"
                onClick={duplicateCurrent}
                title="Duplicate this slide"
                className="rounded-lg border border-border-glass px-2 py-1 text-xs text-text-muted transition-colors hover:text-text-primary"
              >
                ⧉ Duplicate
              </button>
              <button
                type="button"
                onClick={() => setBinOpen(true)}
                disabled={removedSlides.length === 0}
                title={removedSlides.length ? "Restore removed slides" : "No removed slides"}
                className="rounded-lg border border-border-glass px-2 py-1 text-xs text-text-muted transition-colors hover:text-text-primary disabled:opacity-40"
              >
                🗑 Removed{removedSlides.length ? ` (${removedSlides.length})` : ""}
              </button>
              <button
                type="button"
                onClick={() => undo()}
                disabled={!canUndo}
                title="Undo last change (Ctrl+Z)"
                className="rounded-lg border border-border-glass px-2 py-1 text-xs text-text-muted transition-colors hover:text-text-primary disabled:opacity-40"
              >
                ⟲ Undo
              </button>
              <DeckExportButtons slides={slides} design={design} />
            </div>
          )}
        </div>

        {/* Big selected slide — 16:9, centered, flanked by prev/next arrows. */}
        <div className="flex min-h-0 flex-1 items-center justify-center gap-3 overflow-hidden p-6">
          <button
            type="button"
            onClick={() => goTo(-1)}
            disabled={curIndex <= 0}
            title="Previous slide (←)"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-glass bg-black/50 text-lg text-text-muted transition-colors hover:text-text-primary disabled:opacity-25"
          >
            ‹
          </button>
          {selected && (
            <div className="relative aspect-video w-full max-w-[min(64%,calc((100vh-300px)*16/9))] overflow-hidden rounded-xl border border-border-glass shadow-2xl shadow-black/50 ring-1 ring-white/5">
              {/* PPT-style editing: click any text to edit it; use "＋ Text" (top of slide) to add a
                  text box, and use each box's toolbar to duplicate / delete. Persists to the deck. */}
              <SlideRenderer
                slide={selected}
                designDirection={design}
                editing
                imageActions={imageActions}
                onContentChange={(patch) => updateDraftSlide(selected.id, patch)}
              />
              {isSlideGenerating(selected, generating) && (
                <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-black/55 backdrop-blur-sm">
                  <span className="h-9 w-9 animate-spin rounded-full border-2 border-accent-neon/30 border-t-accent-neon" />
                  <span className="text-xs font-medium uppercase tracking-wider text-white/80">Generating art…</span>
                </div>
              )}
              <span className="pointer-events-none absolute bottom-2 right-3 z-30 rounded bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white/80">
                {curIndex + 1} / {slides.length}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => goTo(1)}
            disabled={curIndex >= slides.length - 1}
            title="Next slide (→)"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-glass bg-black/50 text-lg text-text-muted transition-colors hover:text-text-primary disabled:opacity-25"
          >
            ›
          </button>
        </div>

        {/* Filmstrip — the inner `mx-auto` centres the strip when it fits, but (unlike
            `justify-center` on the scroller) still lets it scroll fully when it overflows —
            e.g. when the chat panel narrows this column. */}
        <div className="flex shrink-0 overflow-x-auto border-t border-border-glass bg-black/40 px-4 py-3">
          <div className="mx-auto flex gap-2">
            {slides.map((s, i) => {
              const active = s.id === selectedId;
              return (
                <div
                  key={s.id}
                  className={`group relative w-32 shrink-0 transition-transform ${active ? "z-10 scale-[1.06]" : ""
                    }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    title={s.title}
                    className={`relative block w-full overflow-hidden rounded-lg border-2 transition-all ${active
                      ? "border-accent-neon"
                      : "border-transparent opacity-70 hover:border-white/30 hover:opacity-100"
                      }`}
                  >
                    <SlideThumbnailPreview slide={s} designDirection={design} />
                    {isSlideGenerating(s, generating) && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/55">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent-neon/40 border-t-accent-neon" />
                      </span>
                    )}
                    <span
                      className={`absolute bottom-1 left-1 rounded px-1.5 text-[10px] font-bold ${active ? "bg-accent-neon text-zinc-950" : "bg-black/70 font-medium text-white/80"
                        }`}
                    >
                      {i + 1}
                    </span>
                  </button>
                  {/* Remove → sends the slide to the recycle bin (restorable). Hidden until hover. */}
                  {slides.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteDraftSlide(s.id);
                      }}
                      title="Remove slide (restore from the Removed bin)"
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-xs text-white/90 opacity-0 transition-opacity hover:bg-red-500/90 group-hover:opacity-100"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
            {/* Add a new slide at the end of the deck. */}
            <button
              type="button"
              onClick={() => {
                insertDraftSlideAfter(slides.length - 1, "generic");
                pendingSelectRef.current = slides.length;
              }}
              title="Add a new slide to the end"
              className="flex aspect-video w-32 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed border-white/15 text-text-dim transition-colors hover:border-accent-neon/50 hover:text-text-primary"
            >
              <span className="text-xl leading-none">＋</span>
              <span className="text-[10px] uppercase tracking-wider">Add slide</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right rail — image list + add */}
      <aside className="flex w-72 shrink-0 flex-col border-l border-border-glass bg-surface-1/40">
        <div className="relative flex items-center justify-between gap-2 border-b border-border-glass px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-text-dim">Images</h3>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importImage(f);
              e.currentTarget.value = "";
            }}
          />
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={!!busy}
              className="flex items-center gap-1 rounded-lg border border-border-glass px-2 py-1 text-xs font-semibold text-text-muted transition-colors hover:text-text-primary disabled:opacity-50"
              title="Upload an image from your computer"
            >
              ⬆ Upload
            </button>
            <button
              type="button"
              onClick={() => void generateImage()}
              disabled={!!busy}
              className="flex items-center gap-1 rounded-lg bg-accent-neon px-2.5 py-1 text-xs font-semibold text-zinc-950 transition-colors hover:bg-accent-neon-dim disabled:opacity-50"
              title="Generate one new image for this slide"
            >
              ✨ Generate
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {busy && (
            <p className="mb-3 flex items-center gap-2 text-xs text-text-dim">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent-neon border-t-transparent" />
              {busy === "import" ? "Uploading…" : "Generating…"}
            </p>
          )}
          {images.length === 0 && !busy && (
            <p className="px-1 text-xs text-text-dim">No images yet — use Upload or Generate.</p>
          )}
          {/* Images stacked one below the other. Click to use · click the current one to unselect ·
              ✕ removes it from the gallery. */}
          <div className="flex flex-col gap-2">
            {images.map((u, i) => {
              const current = u === selected?.content.imageUrl;
              return (
                <div
                  key={i}
                  className={`group relative overflow-hidden rounded-lg border-2 transition-colors ${current ? "border-accent-neon" : "border-transparent hover:border-white/40"
                    }`}
                >
                  <button
                    type="button"
                    onClick={() => useImage(u)}
                    title={current ? "Click to unselect (remove from slide)" : "Use on this slide"}
                    className="block w-full"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt="" className="aspect-video w-full object-cover" />
                  </button>
                  {current && (
                    <span className="pointer-events-none absolute left-1 top-1 rounded bg-accent-neon px-1.5 text-[9px] font-semibold text-zinc-950">
                      ✓ In slide
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(u)}
                    title="Remove this image from the gallery"
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded bg-black/70 text-[11px] text-white opacity-0 transition-opacity hover:bg-red-500/80 group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>

          {/* Version history — every previous state of THIS slide (text + image), newest first. */}
          {versions.length > 0 && (
            <div className="mt-5 border-t border-border-glass pt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-text-dim">
                History · {versions.length}
              </h3>
              <div className="flex flex-col gap-2">
                {[...versions].reverse().map((v) => (
                  <button
                    key={v.ts}
                    type="button"
                    onClick={() => restoreVersion(v)}
                    title="Restore this version"
                    className="group flex items-center gap-2 overflow-hidden rounded-lg border border-transparent p-1 text-left transition-colors hover:border-white/30 hover:bg-white/[0.03]"
                  >
                    <span className="relative block h-11 w-20 shrink-0 overflow-hidden rounded bg-surface-2">
                      {v.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v.imageUrl} alt="" className="h-full w-full object-cover" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] text-text-muted">{v.label}</span>
                      <span className="block text-[10px] text-text-dim">
                        {new Date(v.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-accent-neon opacity-0 transition-opacity group-hover:opacity-100">
                      Restore
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Recycle bin — removed slides, restorable. */}
      {binOpen && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-black/95 p-5" onClick={() => setBinOpen(false)}>
          <div className="flex shrink-0 items-center justify-between" onClick={(e) => e.stopPropagation()}>
            <span className="text-sm font-semibold text-white/90">
              Removed slides {removedSlides.length ? `· ${removedSlides.length}` : ""}
            </span>
            <button
              type="button"
              onClick={() => setBinOpen(false)}
              aria-label="Close"
              className="rounded-lg bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          {removedSlides.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-sm text-white/50">
              Nothing here — removed slides will appear so you can restore them.
            </div>
          ) : (
            <div
              className="mt-4 grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3 [scrollbar-width:thin]"
              onClick={(e) => e.stopPropagation()}
            >
              {removedSlides.map((s) => (
                <div key={s.id} className="flex flex-col gap-1.5">
                  <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-surface-0">
                    <SlideThumbnailPreview slide={s} designDirection={design} />
                    <button
                      type="button"
                      onClick={() => restoreSlide(s.id)}
                      className="absolute inset-0 flex items-center justify-center bg-black/0 text-xs font-semibold text-white opacity-0 transition-opacity hover:bg-black/55 hover:opacity-100"
                    >
                      ↩ Restore
                    </button>
                  </div>
                  <span className="truncate text-[11px] text-white/60">{s.title || s.slideType}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SketchIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" className="text-text-dim">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  );
}
