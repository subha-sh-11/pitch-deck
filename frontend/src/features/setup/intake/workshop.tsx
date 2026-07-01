"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  assembleDeck,
  getSlidePrompt,
  pollJob,
  regenerateSlide as apiRegenerateSlide,
  updateSlide as apiUpdateSlide,
  workshopSlideImage,
} from "@/lib/api";
import { useSetupWizard } from "../SetupWizardContext";
import type { Slide } from "@/types/slide";

/**
 * Shared state for the Slide Workshop, lifted above the studio's two columns so the
 * left rail (chat + image-prompt dock) and the right canvas stay in sync on the same
 * selected slide.
 */
interface WorkshopValue {
  slides: Slide[];
  index: number;
  setIndex: (i: number) => void;
  slide: Slide | undefined;
  instructions: string;
  setInstructions: (v: string) => void;
  imagePrompt: string;
  setImagePrompt: (v: string) => void;
  busy: Record<string, "slide" | "image">;
  error: string | null;
  assembling: boolean;
  approvedCount: number;
  allApproved: boolean;
  generate: () => Promise<void>;
  regenImage: () => Promise<void>;
  toggleApprove: () => Promise<void>;
  assemble: () => Promise<boolean>;
}

const WorkshopContext = createContext<WorkshopValue | null>(null);

export function WorkshopProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  const { draftSlides, replaceDraftSlide } = useSetupWizard();

  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState<Record<string, "slide" | "image">>({});
  const [instructions, setInstructions] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [assembling, setAssembling] = useState(false);

  const safeIndex = Math.min(index, Math.max(0, draftSlides.length - 1));
  const slide: Slide | undefined = draftSlides[safeIndex];

  // Reset the prompt panels when the selected slide changes — applied during render (the
  // documented "adjust state when input changes" pattern), not synchronously in an effect.
  const [promptSlideId, setPromptSlideId] = useState<string | undefined>(undefined);
  if (slide && slide.id !== promptSlideId) {
    setPromptSlideId(slide.id);
    setInstructions("Composing the prompt…");
    setImagePrompt(slide.prompts?.imagePrompt ?? slide.content.imagePrompt ?? "");
    setError(null);
  }

  // Fetch the EXACT prompt the LLM will receive for this slide (the stored director-edited
  // one, or the freshly composed real prompt). setState in the promise callback is fine.
  useEffect(() => {
    if (!slide) return;
    let cancelled = false;
    getSlidePrompt(slide.id)
      .then((res) => {
        if (!cancelled) setInstructions(res.prompt);
      })
      .catch(() => {
        if (!cancelled) setInstructions(slide.prompts?.contentPrompt ?? "");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide?.id]);

  const approvedCount = useMemo(
    () => draftSlides.filter((s) => s.status === "approved").length,
    [draftSlides],
  );
  const allApproved = draftSlides.length > 0 && approvedCount === draftSlides.length;

  const clearBusy = useCallback((id: string) => {
    setBusy((b) => {
      const next = { ...b };
      delete next[id];
      return next;
    });
  }, []);

  const generate = useCallback(async () => {
    if (!slide || busy[slide.id]) return;
    setBusy((b) => ({ ...b, [slide.id]: "slide" }));
    setError(null);
    try {
      const job = await apiRegenerateSlide(slide.id, {
        // The panel's text IS the prompt — sent verbatim to the writer model.
        contentPrompt: instructions.trim() || undefined,
        imagePrompt: imagePrompt.trim() || undefined,
        // First generation brings the image along; later regens keep the image
        // unless the director explicitly regenerates it from the dock.
        withImage: !slide.content.imageUrl,
      });
      const final = await pollJob(job);
      if (final.status === "failed") throw new Error(final.error ?? "Generation failed");
      const updated = final.result as Slide;
      if (updated?.id) replaceDraftSlide(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      clearBusy(slide.id);
    }
  }, [slide, busy, instructions, imagePrompt, replaceDraftSlide, clearBusy]);

  const regenImage = useCallback(async () => {
    if (!slide || busy[slide.id]) return;
    setBusy((b) => ({ ...b, [slide.id]: "image" }));
    setError(null);
    try {
      const job = await workshopSlideImage(slide.id, imagePrompt.trim() || undefined);
      const final = await pollJob(job);
      if (final.status === "failed") throw new Error(final.error ?? "Image generation failed");
      const res = final.result as { slide?: Slide; ok?: boolean; reason?: string };
      if (res?.slide) replaceDraftSlide(res.slide);
      if (res && res.ok === false) {
        setError(
          res.reason === "image_provider_unavailable"
            ? "Image provider unavailable right now — kept the previous image."
            : res.reason ?? "Could not generate the image.",
        );
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      clearBusy(slide.id);
    }
  }, [slide, busy, imagePrompt, replaceDraftSlide, clearBusy]);

  const toggleApprove = useCallback(async () => {
    if (!slide) return;
    const nextStatus = slide.status === "approved" ? "draft" : "approved";
    replaceDraftSlide({ ...slide, status: nextStatus });
    try {
      await apiUpdateSlide(slide.id, { status: nextStatus });
    } catch {
      replaceDraftSlide(slide); // revert on failure
    }
  }, [slide, replaceDraftSlide]);

  const assemble = useCallback(async (): Promise<boolean> => {
    setAssembling(true);
    setError(null);
    try {
      await assembleDeck(projectId);
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setAssembling(false);
    }
  }, [projectId]);

  const value = useMemo(
    () => ({
      slides: draftSlides,
      index: safeIndex,
      setIndex,
      slide,
      instructions,
      setInstructions,
      imagePrompt,
      setImagePrompt,
      busy,
      error,
      assembling,
      approvedCount,
      allApproved,
      generate,
      regenImage,
      toggleApprove,
      assemble,
    }),
    [
      draftSlides, safeIndex, slide, instructions, imagePrompt, busy, error, assembling,
      approvedCount, allApproved, generate, regenImage, toggleApprove, assemble,
    ],
  );

  return <WorkshopContext.Provider value={value}>{children}</WorkshopContext.Provider>;
}

export function useWorkshop(): WorkshopValue {
  const ctx = useContext(WorkshopContext);
  if (!ctx) throw new Error("useWorkshop must be used within WorkshopProvider");
  return ctx;
}

/** Like useWorkshop, but returns null instead of throwing when there's no provider —
 *  lets the chat rail read the currently-selected slide without requiring the workshop. */
export function useWorkshopOptional(): WorkshopValue | null {
  return useContext(WorkshopContext);
}

/**
 * The slide-prompt agent — the second panel of the left rail in Slides mode.
 * ONE thing only: the prompt that goes to the LLM to prepare the current slide,
 * as a single editable text block. What you see is what the writer receives.
 */
export function SlidePromptDock() {
  const { slide, instructions, setInstructions, generate, regenImage, toggleApprove, busy, error } =
    useWorkshop();
  if (!slide) return null;
  const busyKind = busy[slide.id];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border-glass bg-surface-1/25">
      <header className="flex shrink-0 items-center justify-between border-b border-border-glass px-3.5 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-accent-neon">
          Prompt → LLM
        </span>
        <span className="flex items-center gap-2 text-[11px] text-text-dim">
          Slide {slide.slideNumber} · {slide.slideType.replace(/_/g, " ")}
          {busyKind && (
            <span className="h-3 w-3 animate-spin rounded-full border border-accent-neon border-t-transparent" />
          )}
        </span>
      </header>

      <textarea
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        spellCheck={false}
        className="min-h-0 w-full flex-1 resize-none bg-transparent p-3.5 font-mono text-[11px] leading-relaxed text-text-primary outline-none placeholder:text-text-dim"
      />

      <footer className="flex shrink-0 items-center gap-2 border-t border-border-glass p-2.5">
        <button
          type="button"
          disabled={!!busyKind}
          onClick={() => void generate()}
          className="flex-1 rounded-full bg-accent-neon px-3 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-accent-neon-dim disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busyKind === "slide" ? "Writing…" : slide.generated ? "Regenerate slide" : "Generate slide"}
        </button>
        <button
          type="button"
          disabled={!!busyKind}
          onClick={() => void regenImage()}
          className="rounded-full border border-border-glass px-3.5 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:border-accent-neon/40 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busyKind === "image" ? "Generating…" : "Image only"}
        </button>
        <button
          type="button"
          disabled={!!busyKind || !slide.generated}
          onClick={() => void toggleApprove()}
          className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            slide.status === "approved"
              ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300"
              : "border-border-glass text-text-muted hover:border-emerald-400/40 hover:text-emerald-300"
          }`}
        >
          {slide.status === "approved" ? "✓" : "Approve"}
        </button>
      </footer>
      {error && <p className="shrink-0 px-3.5 pb-2 text-[11px] leading-snug text-red-400">{error}</p>}
    </div>
  );
}
