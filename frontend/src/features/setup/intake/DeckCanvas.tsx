"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { SlideRenderer } from "@/components/slides/SlideRenderer";
import { SlideThumbnailPreview } from "@/components/slides/SlideThumbnailPreview";
import { OverlayMenuItem, OverlayPanel, useOverlay } from "@/components/ui/overlay";
import { ResizeHandle } from "@/components/ui/ResizeHandle";
import { useSetupWizard } from "@/features/setup/SetupWizardContext";
import { pollJob, workshopSlideImage } from "@/lib/api/generation";
import { uploadSlideImage } from "@/lib/api/projects";
import { buildSlideFromOutline } from "@/lib/build-slides";
import { FALLBACK_DESIGN } from "@/lib/deck-themes";
import { FONT_OPTIONS, loadFont, type FontOption } from "@/lib/fonts";
import { usePanel } from "@/lib/use-panel";
import { useSmoothProgress } from "@/lib/use-smooth-progress";
import type { DesignDirection } from "@/types/design";
import type { Slide, SlideType, SlideVersion } from "@/types/slide";
import { DeckInspector } from "./DeckInspector";
import { Filmstrip } from "./Filmstrip";
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

// Quiet dotted workspace — a shade lighter than the surrounding panels so the editing
// area reads as its own region, with the slide (not the background) in focus.
const CANVAS_BG: CSSProperties = {
  backgroundColor: "rgb(19 17 15)",
  backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)",
  backgroundSize: "26px 26px",
};

/** The design-resolution slide width — zoom % is expressed against this (1280×720). */
const SLIDE_DESIGN_W = 1280;

/** Fixed zoom stops, as % of the design resolution. "Fit" sits alongside these. */
const ZOOM_STEPS = [25, 50, 75, 100, 125, 150, 200, 300];
/** Fit never exceeds this width — a wall-to-wall slide reads as a viewer, not an editor. */
const FIT_MAX_W = 1000;

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

  // 1 ── Real generated deck (after Build): resizable three-pane editor — canvas front and
  // centre, inspector on the right, filmstrip below.
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
      <div className="flex h-full flex-col items-center justify-center gap-5 px-8 text-center" style={CANVAS_BG}>
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
    <div className="relative h-full overflow-y-auto" style={CANVAS_BG}>
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

// Three-pane presentation editor: contextual toolbar up top, zoomable canvas in the middle,
// properties inspector on the right, resizable filmstrip below. Panel sizes persist.
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
    projectId, updateDraftSlide, updateDraftSlideMeta, replaceDraftSlide, applyAccent,
    applyDisplayFont, undo, redo, insertDraftSlideAfter, duplicateDraftSlide, deleteDraftSlide,
    reorderDraftSlide, removedSlides, restoreSlide,
  } = useSetupWizard();
  const [binOpen, setBinOpen] = useState(false);
  useEffect(() => {
    if (!binOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBinOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [binOpen]);

  // Right inspector + bottom filmstrip — resizable, collapsible, persisted.
  const inspector = usePanel({
    key: "deck-inspector", defaultSize: 320, min: 280, max: 420, side: "right", viewportFraction: 0.32,
  });
  const strip = usePanel({
    key: "deck-filmstrip", defaultSize: 132, min: 96, max: 240, side: "bottom", viewportFraction: 0.4,
  });

  // Keep the canvas usable on smaller screens: when the viewport crosses down past
  // ~1200px, auto-collapse the inspector rather than squeezing the slide.
  const { setCollapsed: setInspectorCollapsed } = inspector;
  useEffect(() => {
    let last = window.innerWidth;
    if (last < 1200) setInspectorCollapsed(true);
    const onResize = () => {
      if (window.innerWidth < 1200 && last >= 1200) setInspectorCollapsed(true);
      last = window.innerWidth;
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [setInspectorCollapsed]);

  // After an add/duplicate the slides array grows on the next render; remember which index to
  // select so the new slide opens automatically once it lands.
  const pendingSelectRef = useRef<number | null>(null);

  // Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z (or Ctrl+Y) redoes — unless the user is mid-typing in a
  // text field, where the browser's own text undo should win.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      e.preventDefault();
      if (key === "y" || (key === "z" && e.shiftKey)) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // Set the deck's display font: load the webfont (if not bundled) then apply it deck-wide.
  const setDeckFont = (value: string) => {
    loadFont(value);
    applyDisplayFont(value);
  };
  // Import any Google font by name → loads + applies it (lives in the ⋯ menu).
  const importFontByName = () => {
    const name = window.prompt(
      "Import a font by its Google Fonts name (e.g. \"Rubik Glitch\", \"Lobster\", \"Cinzel Decorative\"):",
    )?.trim();
    if (name) setDeckFont(name);
  };
  // Ensure the current (possibly custom / persisted) deck font is loaded so it renders on open.
  useEffect(() => {
    loadFont(design.fonts?.display);
  }, [design.fonts?.display]);

  const [selectedId, setSelectedId] = useState<string>(slides[0]?.id ?? "");
  const [busy, setBusy] = useState<null | "import" | "generate">(null);
  // Image-action failures (generate/upload) surface in the inspector instead of
  // vanishing into a silent catch.
  const [actionError, setActionError] = useState<string | null>(null);

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

  // ── Canvas zoom: the slide auto-fits the viewport; +/− zoom relative to that fit. ──
  const viewportRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setAvail({ w: el.clientWidth, h: el.clientHeight });
    // Measure NOW rather than waiting for the observer's first delivery, which needs a
    // rendering opportunity (it can lag — or, in a background tab, never come).
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Entering the editor always starts at Fit; manual zoom snaps between the fixed
  // stops and lasts only for the session. Fit keeps ≥48px of workspace visible on
  // every side and caps the slide at FIT_MAX_W even on very wide screens.
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const fitW = Math.max(280, Math.min(avail.w - 96, ((avail.h - 72) * 16) / 9, FIT_MAX_W));
  const slideW = Math.round(zoom === "fit" ? fitW : (SLIDE_DESIGN_W * zoom) / 100);
  const zoomPct = avail.w ? Math.round((slideW / SLIDE_DESIGN_W) * 100) : 100;
  const zoomIn = useCallback(
    () => setZoom(ZOOM_STEPS.find((s) => s > zoomPct) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1]),
    [zoomPct],
  );
  const zoomOut = useCallback(
    () => setZoom([...ZOOM_STEPS].reverse().find((s) => s < zoomPct) ?? ZOOM_STEPS[0]),
    [zoomPct],
  );
  const zoomFit = useCallback(() => setZoom("fit"), []);

  // Ctrl/Cmd +/−/0 zoom the canvas (design-app convention) — not while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        zoomIn();
      } else if (e.key === "-") {
        e.preventDefault();
        zoomOut();
      } else if (e.key === "0") {
        e.preventDefault();
        zoomFit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomIn, zoomOut, zoomFit]);

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
    if (!selected || busy) return;
    setBusy("import");
    setActionError(null);
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
      setActionError("Upload failed — check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  const generateImage = async () => {
    if (!selected || busy) return;
    setBusy("generate");
    setActionError(null);
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
      } else {
        setActionError("Image generation didn't return a result — try again.");
      }
    } catch {
      setActionError("Image generation failed — your current image is untouched. Try again.");
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
    <div className="flex h-full min-h-0" style={CANVAS_BG}>
      {/* Centre column: slide-actions toolbar + canvas + filmstrip. The toolbar lives
          INSIDE this column so it reads as the canvas's own toolbar — the inspector on
          the right is a separate full-height region with its own header. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Slide-actions toolbar — slide position, deck theme, slide actions. */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border-glass bg-surface-0/70 px-3 backdrop-blur">
        <span className="shrink-0 text-xs font-medium text-text-muted">
          Slide {curIndex + 1} <span className="text-text-dim">/ {slides.length}</span>
        </span>
        {generating && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent-neon/10 px-2.5 py-1 text-[11px] text-accent-neon">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent-neon/40 border-t-accent-neon" />
            Building… {buildProgress}%
          </span>
        )}

        {!generating && (
          <>
            <span className="mx-1.5 h-5 w-px shrink-0 bg-border-glass" />
            <div
              className="flex h-9 min-w-0 items-center gap-2 rounded-lg border border-border-glass bg-surface-1/50 px-2.5"
              title="Deck display font — applies to every slide"
            >
              <span className="shrink-0 text-[11px] font-medium text-text-dim">Font</span>
              <select
                value={design.fonts?.display ?? ""}
                onChange={(e) => setDeckFont(e.target.value)}
                className="max-w-[150px] bg-transparent text-[13px] text-text-primary outline-none"
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
            <label
              className="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-border-glass bg-surface-1/50 px-2.5 text-[11px] font-medium text-text-dim"
              title="Deck accent colour — applies to every slide"
            >
              Accent colour
              <input
                type="color"
                defaultValue={deckAccent(design)}
                onChange={(e) => applyAccent(e.target.value)}
                className="h-5 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
              />
            </label>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={addSlideAfter}
                title="Add a new blank slide after this one"
                className="flex h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-surface-3 px-3 text-[13px] font-medium text-text-primary transition-colors hover:border-white/30 hover:bg-[var(--surface-4)]"
              >
                ＋ Add slide
              </button>
              <button
                type="button"
                onClick={duplicateCurrent}
                title="Duplicate this slide"
                className="hidden h-9 items-center gap-1.5 rounded-lg border border-border-glass px-3 text-[13px] text-text-muted transition-colors hover:border-white/30 hover:text-text-primary xl:flex"
              >
                ⧉ Duplicate
              </button>
              <MoreMenu
                items={[
                  // On narrow desktops Duplicate folds in here instead of shrinking the toolbar.
                  { label: "Duplicate slide", onClick: duplicateCurrent, className: "xl:hidden" },
                  { label: "Import custom font…", onClick: importFontByName },
                  {
                    label: `Removed slides…${removedSlides.length ? ` (${removedSlides.length})` : ""}`,
                    onClick: () => setBinOpen(true),
                  },
                ]}
              />
            </div>
          </>
        )}
      </div>

          {/* Canvas viewport — the slide auto-fits and re-centres as panels resize. */}
          <div className="relative min-h-0 flex-1">
            <div ref={viewportRef} className="absolute inset-0 overflow-auto">
              <div className="flex min-h-full w-max min-w-full items-center justify-center px-12 pb-10 pt-8">
                {selected && (
                  <div
                    className="relative aspect-video shrink-0 overflow-hidden rounded-xl border border-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.28),0_18px_48px_rgba(0,0,0,0.32)]"
                    style={{ width: slideW }}
                  >
                    {/* PPT-style editing: click any text to edit it; use "＋ Text" (top of slide) to
                        add a text box, and use each box's toolbar to duplicate / delete. */}
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
                  </div>
                )}
              </div>
            </div>
            {/* Zoom controls — bottom-right, out of the slide's way. */}
            <div className="absolute bottom-3 right-3 z-10 flex items-center gap-0.5 rounded-lg border border-border-glass bg-surface-0/85 p-0.5 backdrop-blur">
              <button
                type="button"
                onClick={zoomOut}
                title="Zoom out (Ctrl −)"
                className="flex h-8 w-8 items-center justify-center rounded-md text-sm text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary"
              >
                −
              </button>
              <button
                type="button"
                onDoubleClick={zoomFit}
                title="Zoom level — double-click to fit"
                className="w-12 cursor-default text-center text-xs tabular-nums text-text-muted"
              >
                {zoomPct}%
              </button>
              <button
                type="button"
                onClick={zoomIn}
                title="Zoom in (Ctrl +)"
                className="flex h-8 w-8 items-center justify-center rounded-md text-sm text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary"
              >
                +
              </button>
              <button
                type="button"
                onClick={zoomFit}
                title="Fit the slide to the canvas (Ctrl 0)"
                className={`flex h-8 items-center rounded-md px-2.5 text-xs font-medium transition-colors hover:bg-surface-2 ${
                  zoom === "fit" ? "text-text-dim" : "text-accent-neon"
                }`}
              >
                Fit
              </button>
            </div>
          </div>

          {/* Filmstrip — resizable via the handle, collapsible to a 32px bar. */}
          {!strip.collapsed && <ResizeHandle dragging={strip.dragging} {...strip.handleProps} />}
          {strip.collapsed && <div className="h-px w-full bg-border-glass" />}
          <Filmstrip
            slides={slides}
            selectedId={selectedId}
            design={design}
            generating={generating}
            isSlideGenerating={isSlideGenerating}
            height={strip.size}
            collapsed={strip.collapsed}
            onToggleCollapsed={strip.toggle}
            onSelect={setSelectedId}
            onDelete={deleteDraftSlide}
            onAddEnd={() => {
              insertDraftSlideAfter(slides.length - 1, "generic");
              pendingSelectRef.current = slides.length;
            }}
            onReorder={(from, to) => {
              reorderDraftSlide(from, to);
              lastIndexRef.current = to;
            }}
            removedCount={removedSlides.length}
            onOpenBin={() => setBinOpen(true)}
          />
      </div>

      {/* Properties inspector — a full-height right region with its own header;
          resizable from its left edge, collapsible to an icon rail. The width
          animates on collapse/expand but NOT while dragging the handle. */}
      {!inspector.collapsed && <ResizeHandle dragging={inspector.dragging} {...inspector.handleProps} />}
      <aside
        style={{ width: inspector.collapsed ? 44 : inspector.size }}
        className={`min-h-0 shrink-0 overflow-hidden ${inspector.dragging ? "" : "transition-[width] duration-200"}`}
      >
        <DeckInspector
          slide={selected}
          images={images}
          currentImageUrl={selected?.content.imageUrl}
          versions={versions}
          busy={busy}
          actionError={actionError}
          onClearError={() => setActionError(null)}
          onUseImage={useImage}
          onRemoveImage={removeImage}
          onImportImage={(f) => void importImage(f)}
          onGenerateImage={() => void generateImage()}
          onRestoreVersion={restoreVersion}
          onAppearance={(patch) => selected && updateDraftSlideMeta(selected.id, { appearance: patch })}
          collapsed={inspector.collapsed}
          onExpand={() => inspector.setCollapsed(false)}
          onCollapse={() => inspector.setCollapsed(true)}
        />
      </aside>

      {/* Recycle bin — removed slides, restorable. Modal: backdrop at z-50 per the
          documented scale; Escape or a backdrop click closes it. */}
      {binOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Removed slides"
          className="fixed inset-0 z-50 flex flex-col bg-black/95 p-5"
          onClick={() => setBinOpen(false)}
        >
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

// Infrequent toolbar actions live behind this three-dot menu so the bar stays quiet.
function MoreMenu({ items }: { items: { label: string; onClick: () => void; className?: string }[] }) {
  const menu = useOverlay("menu");
  return (
    <div className="shrink-0">
      <button
        type="button"
        {...menu.triggerProps}
        title="More actions"
        aria-label="More actions"
        className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
          menu.open
            ? "border-white/30 bg-surface-2 text-text-primary"
            : "border-border-glass text-text-muted hover:border-white/30 hover:text-text-primary"
        }`}
      >
        <DotsIcon />
      </button>
      <OverlayPanel state={menu} align="end" label="More actions" className="w-56 p-1">
        {items.map((it) => (
          <OverlayMenuItem key={it.label} onSelect={it.onClick} className={it.className}>
            {it.label}
          </OverlayMenuItem>
        ))}
      </OverlayPanel>
    </div>
  );
}

function DotsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
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
