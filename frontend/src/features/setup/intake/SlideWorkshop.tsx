"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SlideRenderer } from "@/components/slides/SlideRenderer";
import {
  pollJob,
  regenerateSlide as apiRegenerateSlide,
  slideImageVariants,
  updateSlide as apiUpdateSlide,
  uploadSlideImage,
} from "@/lib/api";
import { useSmoothProgress } from "@/lib/use-smooth-progress";
import { useSetupWizard } from "../SetupWizardContext";
import { useWorkshop } from "./workshop";
import { SLIDE_TYPE_LABELS, type Slide, type SlideContent } from "@/types/slide";
import type { DesignDirection } from "@/types/design";

// Render the slide at its true 16:9 size, then scale the whole thing to fit the card —
// so typography/layout stay correct (no overflow) at any card size.
const BASE_W = 1280;
const BASE_H = 720;

function ScaledSlide({ slide, designDirection }: { slide: Slide; designDirection?: DesignDirection }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setScale(Math.min(r.width / BASE_W, r.height / BASE_H));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden">
      {scale > 0 && (
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            width: BASE_W,
            height: BASE_H,
            transform: `translate(-50%, -50%) scale(${scale})`,
          }}
        >
          <SlideRenderer slide={slide} designDirection={designDirection} />
        </div>
      )}
    </div>
  );
}

/**
 * Slide Workshop — a vertical list of per-slide cards. Each card has the editable
 * prompt + controls on the LEFT and the (inline-editable) slide on the RIGHT, so the
 * director can regenerate, tweak the prompt, edit text, and swap the image in place.
 */
export function SlideWorkshop(_props: { onAssembled: () => void }) {
  const {
    generationStatus,
    generationProgress,
    generationError,
    replaceDraftSlide,
    regenerateAllDraftSlides,
    designDirection,
    deckHistory,
  } = useSetupWizard();
  const displayProgress = useSmoothProgress(generationProgress, generationStatus === "generating");
  const { slides } = useWorkshop();
  const [genAll, setGenAll] = useState<{ running: boolean; done: number; total: number }>({
    running: false,
    done: 0,
    total: 0,
  });
  // Previous deck versions live in the wizard context — they're archived before EVERY (re)build
  // (Rebuild deck, Build deck, or a style change), so nothing is ever lost regardless of trigger.
  const history = deckHistory;
  const [historyOpen, setHistoryOpen] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);

  const generatedCount = slides.filter((s) => s.generated).length;
  const allGenerated = slides.length > 0 && generatedCount === slides.length;
  // Slides whose art is a gradient placeholder because the image provider failed (out of
  // credits, bad key…). The backend records why on the slide, so tell the director instead of
  // silently shipping gradients behind a green "all generated".
  const imageFailures = slides.filter((s) => s.content.imageError);
  const imageFailureReason = imageFailures[0]?.content.imageError ?? "";

  // Rebuild = generate a brand-new deck from scratch. The context archives the current deck into
  // history first (same as Build deck / a style change), so the old one is always recoverable.
  const rebuildDeck = async () => {
    if (rebuilding || generationStatus === "generating") return;
    setRebuilding(true);
    try {
      await regenerateAllDraftSlides();
    } finally {
      setRebuilding(false);
    }
  };

  // Generate every not-yet-built slide in sequence (quota-safe), with live progress.
  const generateAll = async () => {
    if (genAll.running) return;
    const targets = slides.filter((s) => !s.generated);
    if (!targets.length) return;
    setGenAll({ running: true, done: 0, total: targets.length });
    for (const s of targets) {
      try {
        const job = await apiRegenerateSlide(s.id, { withImage: !s.content.imageUrl });
        const final = await pollJob(job);
        if (final.status !== "failed") {
          const updated = final.result as Slide;
          if (updated?.id) replaceDraftSlide(updated);
        }
      } catch {
        /* skip this slide, keep going */
      }
      setGenAll((g) => ({ ...g, done: g.done + 1 }));
    }
    setGenAll((g) => ({ ...g, running: false }));
  };

  if (generationStatus === "generating") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-text-muted">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-neon border-t-transparent" />
        <p className="text-sm">Architecting your deck — {displayProgress}%</p>
        <p className="text-xs text-text-dim">Story analysis · design language · slide outline</p>
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-text-muted">
        <p className="text-sm">No slides yet — hit “Build deck” to architect the outline.</p>
        {generationError && <p className="text-xs text-red-400">{generationError}</p>}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Toolbar — generate all, view history, rebuild the whole deck */}
      <div className="flex shrink-0 flex-col gap-2 border-b border-border-glass bg-surface-0/40 px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-text-dim">
            <span className="text-text-muted">{generatedCount}</span>/{slides.length} generated
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void generateAll()}
              disabled={genAll.running || allGenerated}
              className="rounded-full bg-accent-neon px-4 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-accent-neon-dim disabled:cursor-not-allowed disabled:bg-accent-neon/25 disabled:text-zinc-950/60"
            >
              {genAll.running ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-950/40 border-t-zinc-950" />
                  Generating {genAll.done}/{genAll.total}…
                </span>
              ) : allGenerated ? (
                "✓ All generated"
              ) : (
                "✦ Generate all slides"
              )}
            </button>
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              disabled={history.length === 0}
              title={history.length ? "View the previous deck versions" : "No previous versions yet"}
              className="rounded-full border border-border-glass px-3 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:border-accent-neon/40 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              🕘 History{history.length ? ` (${history.length})` : ""}
            </button>
            <button
              type="button"
              onClick={() => void rebuildDeck()}
              disabled={rebuilding || genAll.running}
              title="Archive this deck and generate a brand-new one"
              className="rounded-full bg-accent-neon px-4 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-accent-neon-dim disabled:cursor-not-allowed disabled:bg-accent-neon/25 disabled:text-zinc-950/60"
            >
              {rebuilding ? "Rebuilding…" : "↻ Rebuild deck"}
            </button>
          </div>
        </div>
        {/* Image-provider failure: the deck built, but slides carry gradient placeholders
            instead of generated art. Say why, and how to recover. */}
        {imageFailures.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <span className="font-semibold">
              ⚠ Slide images couldn’t be generated ({imageFailures.length}/{slides.length} slides
              are showing placeholder art).
            </span>{" "}
            <span className="text-amber-200/80">{imageFailureReason}</span>{" "}
            <span className="text-amber-200/80">
              Fix the provider (e.g. top up credits), then use “Regenerate slide” or “Rebuild deck”.
            </span>
          </div>
        )}
        {/* Live progress while generating all. At 0% we show an indeterminate shimmer so the
            bar is always visibly "working"; once slides land it becomes a real progress fill. */}
        {genAll.running && (
          <div className="relative h-1 w-full overflow-hidden rounded-full bg-surface-2/70">
            {genAll.done === 0 ? (
              <div className="h-full w-2/5 animate-pulse rounded-full bg-accent-neon" />
            ) : (
              <div
                className="h-full rounded-full bg-accent-neon transition-[width] duration-300"
                style={{ width: `${genAll.total ? (genAll.done / genAll.total) * 100 : 0}%` }}
              />
            )}
          </div>
        )}
      </div>

      {/* Vertical card list */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 [scrollbar-width:thin]">
        {slides.map((s) => (
          <SlideCard key={s.id} slide={s} deckGenerating={genAll.running} />
        ))}
      </div>

      {historyOpen && (
        <DeckHistory
          history={history}
          designDirection={designDirection ?? undefined}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </div>
  );
}

/** Read-only viewer for archived deck versions — the previous whole decks captured before each
 *  Rebuild. Lets the director scroll through an earlier version's slides (newest archive first). */
function DeckHistory({
  history,
  designDirection,
  onClose,
}: {
  history: Slide[][];
  designDirection?: DesignDirection;
  onClose: () => void;
}) {
  const [version, setVersion] = useState(0);
  const deck = history[version] ?? [];
  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/95 p-5" onClick={onClose}>
      <div
        className="flex shrink-0 flex-wrap items-center justify-between gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white/90">Deck history</span>
          {history.length > 1 && (
            <div className="flex items-center gap-1 rounded-lg bg-white/10 p-0.5">
              {history.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setVersion(i)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                    i === version ? "bg-accent-neon text-zinc-950" : "text-white/70 hover:text-white"
                  }`}
                >
                  {i === 0 ? "Previous" : `−${i + 1}`}
                </button>
              ))}
            </div>
          )}
          <span className="text-xs text-white/50">{deck.length} slides</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-lg bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div
        className="mt-4 grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3 [scrollbar-width:thin]"
        onClick={(e) => e.stopPropagation()}
      >
        {deck.map((s) => (
          <div key={s.id} className="flex flex-col gap-1.5">
            <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-surface-0">
              <ScaledSlide slide={s} designDirection={designDirection} />
            </div>
            <span className="text-[11px] text-white/50">
              Slide {s.slideNumber} · {SLIDE_TYPE_LABELS[s.slideType]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlideCard({ slide, deckGenerating = false }: { slide: Slide; deckGenerating?: boolean }) {
  const { projectId, designDirection, replaceDraftSlide } = useSetupWizard();
  // Which slide the chat's "this slide" resolves to — clicking a card makes it active.
  const { slides: wsSlides, slide: activeSlide, setIndex } = useWorkshop();
  const isActive = activeSlide?.id === slide.id;
  const markActive = () => {
    const i = wsSlides.findIndex((s) => s.id === slide.id);
    if (i >= 0) setIndex(i);
  };
  const [imagePrompt, setImagePrompt] = useState(
    slide.prompts?.imagePrompt ?? slide.content.imagePrompt ?? "",
  );
  const [busy, setBusy] = useState<null | "slide" | "image">(null);
  const [err, setErr] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null); // full-size preview of one option
  const [uploading, setUploading] = useState(false);
  const [tweakOpen, setTweakOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Download an option. The backend serves ?download=1 with a Content-Disposition attachment
  // header, so the browser saves the file (works cross-origin, no CORS fetch needed).
  const downloadImage = (url: string) => {
    const href = url.includes("?") ? `${url}&download=1` : `${url}?download=1`;
    const a = document.createElement("a");
    a.href = href;
    a.download = `slide-${slide.slideNumber}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const onContentChange = useCallback(
    (patch: Partial<SlideContent>) => {
      replaceDraftSlide({ ...slide, content: { ...slide.content, ...patch } });
      if (!slide.id.startsWith("local-")) {
        void apiUpdateSlide(slide.id, { content: patch }).catch(() => { });
      }
    },
    [slide, replaceDraftSlide],
  );

  const generate = async () => {
    if (busy) return;
    setBusy("slide");
    setErr(null);
    try {
      const job = await apiRegenerateSlide(slide.id, {
        imagePrompt: imagePrompt.trim() || undefined,
        // Always regenerate the image too — an explicit "Regenerate slide" click should
        // visibly redo the whole slide.
        withImage: true,
        // On a RE-generate (slide already exists), force a genuinely fresh take: this
        // instruction bypasses the writer's content cache AND asks for a new angle/phrasing,
        // so the text changes too — not just the image.
        ...(slide.generated
          ? {
            instructions:
              "Rewrite this slide completely fresh — a distinctly different angle, new phrasing, "
              + "and a new headline. Do NOT repeat the previous version's wording.",
          }
          : {}),
      });
      const final = await pollJob(job);
      if (final.status === "failed") throw new Error(final.error ?? "Generation failed");
      const updated = final.result as Slide;
      if (updated?.id) replaceDraftSlide(updated);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const toggleApprove = async () => {
    const next = slide.status === "approved" ? "draft" : "approved";
    replaceDraftSlide({ ...slide, status: next });
    try {
      await apiUpdateSlide(slide.id, { status: next });
    } catch {
      replaceDraftSlide(slide);
    }
  };

  const replaceImage = async (file: File) => {
    setUploading(true);
    setErr(null);
    try {
      const url = await uploadSlideImage(projectId, file);
      onContentChange({ imageUrl: url });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  // Generate 3 image options the director can pick from in the full-screen gallery.
  const genVariants = async () => {
    if (busy) return;
    setBusy("image");
    setErr(null);
    try {
      const res = await slideImageVariants(slide.id, imagePrompt.trim() || undefined);
      if (res.slide) replaceDraftSlide(res.slide);
      if (res.ok) {
        setLightbox(true);
      } else {
        setErr(
          res.reason === "image_provider_unavailable"
            ? "Image provider unavailable — try again shortly."
            : res.reason ?? "Couldn't generate options.",
        );
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const approved = slide.status === "approved";
  const imageUrl = slide.content.imageUrl;
  // Always keep the CURRENT image in the options so it never disappears when new options
  // are generated — the new ones are added alongside it, not in place of it.
  const candidates = (() => {
    const fromBackend = slide.content.imageCandidates ?? [];
    if (!fromBackend.length) return imageUrl ? [imageUrl] : [];
    return imageUrl && !fromBackend.includes(imageUrl) ? [imageUrl, ...fromBackend] : fromBackend;
  })();

  // Just open the gallery to browse the EXISTING image/options — never auto-generate.
  // New options are created only when the director clicks "Generate 3 options".
  const openGallery = () => setLightbox(true);

  return (
    <div
      onMouseDown={markActive}
      title={isActive ? "The chat's edits apply to this slide" : "Click to edit this slide via chat"}
      className={`grid grid-cols-1 gap-4 rounded-2xl border bg-surface-1/30 p-4 transition-colors lg:h-[clamp(240px,33vh,380px)] lg:grid-cols-[280px_minmax(0,1fr)] lg:overflow-hidden ${isActive ? "border-accent-neon/60 ring-1 ring-accent-neon/30" : "border-border-glass"
        }`}
    >
      {/* LEFT — a clean control rail (no per-slide prompt; the deck writes as one whole) */}
      <div className="flex min-w-0 flex-col gap-3 lg:overflow-y-auto lg:pr-1">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void replaceImage(f);
            e.currentTarget.value = "";
          }}
        />

        {/* Header — status dot + slide number + type */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${approved ? "bg-emerald-400" : slide.generated ? "bg-accent-neon" : "bg-zinc-600"
                }`}
            />
            <h3 className="text-sm font-semibold text-text-primary">Slide {slide.slideNumber}</h3>
          </div>
          <span className="rounded-full border border-border-glass px-2 py-0.5 text-[10px] uppercase tracking-wider text-text-dim">
            {SLIDE_TYPE_LABELS[slide.slideType]}
          </span>
        </div>

        {/* Primary action — write / regenerate the whole slide (copy + imagery). */}
        <div className="flex items-stretch gap-2">
          <button
            type="button"
            onClick={() => void generate()}
            disabled={!!busy}
            className="flex-1 rounded-xl bg-accent-neon px-3 py-2.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-accent-neon-dim disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy === "slide"
              ? "Writing the slide…"
              : slide.generated
                ? "↻ Regenerate slide"
                : "✦ Generate slide"}
          </button>
        </div>

        {/* Thumbnail → full-screen gallery */}
        {imageUrl && (
          <button
            type="button"
            onClick={openGallery}
            title="View / choose images full screen"
            className="group relative overflow-hidden rounded-lg border border-border-glass"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" className="aspect-video w-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-xs font-medium text-white opacity-0 transition-opacity group-hover:bg-black/45 group-hover:opacity-100">
              ⤢ View options
            </span>
          </button>
        )}

        {/* Secondary actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-border-glass px-2 py-1.5 text-[11px] font-semibold text-text-muted transition-colors hover:border-accent-neon/40 hover:text-text-primary disabled:opacity-40"
          >
            {uploading ? "Uploading…" : "⬆ Replace image"}
          </button>
          <button
            type="button"
            onClick={() => void toggleApprove()}
            disabled={!slide.generated}
            className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${approved
                ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300"
                : "border-border-glass text-text-muted hover:border-emerald-400/40 hover:text-emerald-300"
              }`}
          >
            {approved ? "Approved ✓" : "Approve"}
          </button>
        </div>

        {/* Optional — nudge the image look (collapsed by default) */}
        <div>
          <button
            type="button"
            onClick={() => setTweakOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg px-0.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-dim transition-colors hover:text-text-muted"
          >
            <span>⚙ Tweak image look</span>
            <span className="text-sm leading-none">{tweakOpen ? "–" : "+"}</span>
          </button>
          {tweakOpen && (
            <textarea
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              spellCheck={false}
              placeholder="e.g. moodier lighting, wider shot, warmer palette…"
              className="mt-1 h-20 w-full resize-none rounded-lg border border-border-glass bg-surface-0/50 p-2.5 text-[11px] leading-relaxed text-text-muted outline-none focus:border-accent-neon/40 placeholder:text-text-dim"
            />
          )}
        </div>

        {err && <p className="text-[11px] leading-snug text-red-400">{err}</p>}
      </div>

      {/* RIGHT — the slide (inline-editable when generated). Height-bounded so the card
          stays compact and several slides fit on screen at once. */}
      <div className="flex min-h-0 min-w-0 flex-col">
        <div className="relative mx-auto aspect-video w-full max-w-full overflow-hidden rounded-xl border border-border-glass bg-surface-0 shadow-[0_8px_30px_rgba(0,0,0,0.4)] lg:h-full lg:w-auto">
          {slide.generated ? (
            <ScaledSlide slide={slide} designDirection={designDirection ?? undefined} />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center">
              {deckGenerating && (
                <span className="mb-1 h-6 w-6 animate-spin rounded-full border-2 border-accent-neon/40 border-t-accent-neon" />
              )}
              <h4 className="font-display text-xl font-semibold text-text-primary">{slide.title}</h4>
              {slide.purpose && (
                <p className="max-w-[70%] text-xs leading-relaxed text-text-muted">{slide.purpose}</p>
              )}
              {deckGenerating && (
                <p className="mt-1 text-[11px] uppercase tracking-wider text-accent-neon/80">Preparing this slide…</p>
              )}
            </div>
          )}
          {busy && (
            <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-black/30">
              <div className="flex items-center gap-2 rounded-full bg-surface-1/95 px-4 py-2 text-xs font-medium text-text-primary shadow-lg">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent-neon border-t-transparent" />
                {busy === "image" ? "Generating image…" : "Writing the slide…"}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full-size preview of a single option (above the gallery) */}
      {zoom && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 p-8" onClick={() => setZoom(null)}>
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={zoom} alt="" className="max-h-[86vh] max-w-[92vw] rounded-xl object-contain shadow-2xl" />
            <div className="absolute right-2 top-2 flex gap-2">
              <button type="button" onClick={() => void downloadImage(zoom)} title="Download"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
              </button>
              <button type="button" onClick={() => setZoom(null)} aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-lg text-white backdrop-blur hover:bg-black/80">×</button>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen image gallery — browse the options and pick one */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[200] flex flex-col bg-black/95 p-5"
          onClick={() => setLightbox(false)}
        >
          <div
            className="flex shrink-0 items-center justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-sm text-white/80">
              Slide {slide.slideNumber} — choose an image ({candidates.length})
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void genVariants()}
                className="rounded-lg bg-accent-neon px-3 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-accent-neon-dim disabled:opacity-50"
              >
                {busy === "image" ? "Generating…" : "✨ Generate 3 options"}
              </button>
              <button
                type="button"
                onClick={() => setLightbox(false)}
                aria-label="Close"
                className="rounded-lg bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div
            className="mt-4 grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3"
            onClick={(e) => e.stopPropagation()}
          >
            {candidates.map((u, i) => {
              const selected = u === imageUrl;
              return (
                <div
                  key={i}
                  className={`group relative h-fit overflow-hidden rounded-xl border-2 transition-colors ${selected ? "border-accent-neon" : "border-transparent hover:border-white/40"
                    }`}
                >
                  {/* Click places it in the slide */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={u}
                    alt=""
                    onClick={() => onContentChange({ imageUrl: u })}
                    className="aspect-video w-full cursor-pointer object-cover"
                    title="Click to use this image"
                  />
                  {/* Enlarge + download (don't select) */}
                  <div className="absolute left-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button type="button" onClick={() => setZoom(u)} title="Enlarge"
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white hover:bg-black/80">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
                    </button>
                    <button type="button" onClick={() => void downloadImage(u)} title="Download"
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white hover:bg-black/80">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></svg>
                    </button>
                  </div>
                  <span
                    className={`absolute right-2 top-2 rounded px-2 py-0.5 text-[10px] font-semibold ${selected ? "bg-accent-neon text-zinc-950" : "bg-black/60 text-white opacity-0 group-hover:opacity-100"
                      }`}
                  >
                    {selected ? "✓ In deck" : "Use this"}
                  </span>
                </div>
              );
            })}
            {busy === "image" &&
              Array.from({ length: Math.max(0, 3 - candidates.length) }).map((_, i) => (
                <div
                  key={`sk-${i}`}
                  className="flex aspect-video items-center justify-center rounded-xl border border-white/10 bg-white/5"
                >
                  <span className="h-7 w-7 animate-spin rounded-full border-2 border-accent-neon border-t-transparent" />
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
