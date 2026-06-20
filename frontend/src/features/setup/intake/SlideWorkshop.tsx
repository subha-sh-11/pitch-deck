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
export function SlideWorkshop({ onAssembled }: { onAssembled: () => void }) {
  const { generationStatus, generationProgress, generationError, replaceDraftSlide } =
    useSetupWizard();
  const { slides, approvedCount, allApproved, assembling, assemble } = useWorkshop();
  const [genAll, setGenAll] = useState<{ running: boolean; done: number; total: number }>({
    running: false,
    done: 0,
    total: 0,
  });
  const [approvingAll, setApprovingAll] = useState(false);

  const generatedCount = slides.filter((s) => s.generated).length;
  const allGenerated = slides.length > 0 && generatedCount === slides.length;
  const anyToApprove = slides.some((s) => s.generated && s.status !== "approved");

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

  const approveAll = async () => {
    setApprovingAll(true);
    for (const s of slides) {
      if (s.generated && s.status !== "approved") {
        replaceDraftSlide({ ...s, status: "approved" });
        try {
          await apiUpdateSlide(s.id, { status: "approved" });
        } catch {
          /* keep going */
        }
      }
    }
    setApprovingAll(false);
  };

  if (generationStatus === "generating") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-text-muted">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-neon border-t-transparent" />
        <p className="text-sm">Architecting your deck — {generationProgress}%</p>
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
      {/* Toolbar — generate all, approve all, assemble */}
      <div className="flex shrink-0 flex-col gap-2 border-b border-border-glass bg-surface-0/40 px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-text-dim">
            <span className="text-text-muted">{generatedCount}</span>/{slides.length} generated ·{" "}
            <span className="text-emerald-400/90">{approvedCount}</span>/{slides.length} approved
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void generateAll()}
              disabled={genAll.running || allGenerated}
              className="rounded-full bg-accent-neon px-4 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-accent-neon-dim disabled:cursor-not-allowed disabled:bg-accent-neon/25 disabled:text-zinc-950/60"
            >
              {genAll.running
                ? `Generating ${genAll.done}/${genAll.total}…`
                : allGenerated
                  ? "✓ All generated"
                  : "✦ Generate all slides"}
            </button>
            <button
              type="button"
              onClick={() => void approveAll()}
              disabled={!anyToApprove || approvingAll}
              className="rounded-full border border-emerald-400/40 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {approvingAll ? "Approving…" : "Approve all"}
            </button>
            <button
              type="button"
              disabled={!allApproved || assembling}
              onClick={() => void assemble().then((ok) => ok && onAssembled())}
              className="rounded-full bg-accent-neon px-4 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-accent-neon-dim disabled:cursor-not-allowed disabled:bg-accent-neon/25 disabled:text-zinc-950/60"
            >
              {assembling ? "Assembling…" : "Assemble deck →"}
            </button>
          </div>
        </div>
        {/* Live progress while generating all */}
        {genAll.running && (
          <div className="h-1 w-full overflow-hidden rounded-full bg-surface-2/70">
            <div
              className="h-full rounded-full bg-accent-neon transition-[width] duration-300"
              style={{ width: `${genAll.total ? (genAll.done / genAll.total) * 100 : 0}%` }}
            />
          </div>
        )}
      </div>

      {/* Vertical card list */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 [scrollbar-width:thin]">
        {slides.map((s) => (
          <SlideCard key={s.id} slide={s} />
        ))}
      </div>
    </div>
  );
}

function SlideCard({ slide }: { slide: Slide }) {
  const { projectId, designDirection, replaceDraftSlide } = useSetupWizard();
  const [imagePrompt, setImagePrompt] = useState(
    slide.prompts?.imagePrompt ?? slide.content.imagePrompt ?? "",
  );
  const [busy, setBusy] = useState<null | "slide" | "image">(null);
  const [err, setErr] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tweakOpen, setTweakOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onContentChange = useCallback(
    (patch: Partial<SlideContent>) => {
      replaceDraftSlide({ ...slide, content: { ...slide.content, ...patch } });
      if (!slide.id.startsWith("local-")) {
        void apiUpdateSlide(slide.id, { content: patch }).catch(() => {});
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
        // No per-slide content prompt — the deck is generated as one coherent whole,
        // so the writer composes from the shared brief/design automatically.
        imagePrompt: imagePrompt.trim() || undefined,
        withImage: !slide.content.imageUrl,
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
  const candidates = slide.content.imageCandidates?.length
    ? slide.content.imageCandidates
    : imageUrl
      ? [imageUrl]
      : [];

  // Open the full-screen gallery; if we don't yet have a few options, generate them
  // so the gallery shows multiple choices instead of a single oversized image.
  const openGallery = () => {
    setLightbox(true);
    if (candidates.length < 3 && !busy) void genVariants();
  };

  return (
    <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border-glass bg-surface-1/30 p-4 lg:h-[clamp(240px,33vh,380px)] lg:grid-cols-[280px_minmax(0,1fr)] lg:overflow-hidden">
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
              className={`h-2.5 w-2.5 rounded-full ${
                approved ? "bg-emerald-400" : slide.generated ? "bg-accent-neon" : "bg-zinc-600"
              }`}
            />
            <h3 className="text-sm font-semibold text-text-primary">Slide {slide.slideNumber}</h3>
          </div>
          <span className="rounded-full border border-border-glass px-2 py-0.5 text-[10px] uppercase tracking-wider text-text-dim">
            {SLIDE_TYPE_LABELS[slide.slideType]}
          </span>
        </div>

        {/* Primary actions — write/rewrite the slide and generate image options, side by side */}
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

          <button
            type="button"
            onClick={() => void genVariants()}
            disabled={!!busy}
            className="flex-1 rounded-xl border border-accent-neon/40 bg-accent-neon/5 px-3 py-2 text-[11px] font-semibold text-text-muted transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy === "image" ? "Generating images…" : "✨ Generate 3 image options"}
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
            className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              approved
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
              <h4 className="font-display text-xl font-semibold text-text-primary">{slide.title}</h4>
              {slide.purpose && (
                <p className="max-w-[70%] text-xs leading-relaxed text-text-muted">{slide.purpose}</p>
              )}
              <button
                type="button"
                onClick={() => void generate()}
                disabled={!!busy}
                className="mt-2 rounded-full bg-accent-neon px-5 py-2 text-xs font-semibold text-zinc-950 transition-colors hover:bg-accent-neon-dim disabled:opacity-40"
              >
                ✦ Generate this slide
              </button>
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
                <button
                  key={i}
                  type="button"
                  onClick={() => onContentChange({ imageUrl: u })}
                  className={`group relative h-fit overflow-hidden rounded-xl border-2 transition-colors ${
                    selected ? "border-accent-neon" : "border-transparent hover:border-white/40"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="aspect-video w-full object-cover" />
                  <span
                    className={`absolute right-2 top-2 rounded px-2 py-0.5 text-[10px] font-semibold ${
                      selected
                        ? "bg-accent-neon text-zinc-950"
                        : "bg-black/60 text-white opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    {selected ? "✓ Selected" : "Use this"}
                  </span>
                </button>
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
