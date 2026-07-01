"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SlideRenderer } from "@/components/slides/SlideRenderer";
import { getDesignCandidates, type DesignCandidate } from "@/lib/api/deck";
import type { Slide } from "@/types/slide";
import { useSetupWizard } from "../SetupWizardContext";

/**
 * After the summary is ready, the producer proposes 4-5 distinct VISUAL SYSTEMS (complete
 * "templates": palette, type, layout, image treatment) grounded in the story. Each card is a live
 * mini-render of a cover slide in that system, so the director sees the feeling before choosing.
 * Picking one applies it deck-wide (previewed instantly; persisted when the deck is built).
 */
export function DesignCandidates({ projectId }: { projectId: string }) {
  const { formData, chooseDesign } = useSetupWizard();
  const [candidates, setCandidates] = useState<DesignCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const startedRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDesignCandidates(projectId);
      setCandidates(res.candidates ?? []);
    } catch {
      setError("Couldn't generate visual directions — tap retry.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Generate once when the picker first appears.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void load();
  }, [load]);

  const sampleSlide = (): Slide => ({
    id: "preview",
    slideNumber: 1,
    slideType: "cover",
    title: formData.title || "Your Film",
    purpose: "",
    content: {
      heading: formData.title || "Your Film",
      subheading: formData.tagline || formData.genreBlend || "",
      body: formData.logline || "",
    },
    layout: { template: "cover", layoutType: "centered_title" },
    status: "draft",
  });

  const pick = (c: DesignCandidate) => {
    setPicked(c.id);
    chooseDesign(c.design);
  };

  return (
    <section className="shrink-0 border-b border-border-glass bg-surface-1/30 px-4 py-3">
      <header className="mb-2.5 flex items-center justify-between">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-neon">
            Choose a visual direction
          </h3>
          <p className="text-[11px] text-text-dim">
            Distinct templates tailored to your story — tap one to apply it to the whole deck.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-full border border-border-glass px-2.5 py-1 text-[11px] text-text-muted transition-colors hover:border-accent-neon/40 hover:text-text-primary disabled:opacity-40"
        >
          {loading ? "Generating…" : "Regenerate"}
        </button>
      </header>

      {error && <p className="mb-2 text-[11px] text-red-400">{error}</p>}

      {loading && candidates.length === 0 ? (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="aspect-video w-44 shrink-0 animate-pulse rounded-lg border border-border-glass bg-surface-2/40"
            />
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {candidates.map((c) => {
            const active = picked === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => pick(c)}
                title={c.vibe}
                className={`group shrink-0 overflow-hidden rounded-lg border-2 text-left transition-all duration-200 ${
                  active
                    ? "border-accent-neon shadow-[0_0_16px_rgba(248,201,164,0.3)]"
                    : "border-border-glass opacity-90 hover:-translate-y-0.5 hover:opacity-100"
                }`}
              >
                <div className="h-[99px] w-44 overflow-hidden">
                  <SlideRenderer slide={sampleSlide()} designDirection={c.design} />
                </div>
                <div className="w-44 bg-surface-0/70 px-2.5 py-1.5">
                  <p className="truncate text-xs font-medium text-text-primary">{c.label}</p>
                  {c.vibe && <p className="truncate text-[10px] text-text-dim">{c.vibe}</p>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
