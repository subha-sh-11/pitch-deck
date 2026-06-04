"use client";

import { useEffect, useState } from "react";

interface GeneratingOverlayProps {
  /** 0–100 from the generation job; shown as a progress bar when provided. */
  progress?: number;
}

const STAGES = [
  "Reading your story's DNA…",
  "Choosing a color palette from your genre…",
  "Setting the cinematic tone…",
  "Directing the cover shot…",
  "Writing producer-ready copy…",
  "Generating cinematic imagery for every slide…",
  "Composing layouts…",
  "Color-grading the deck…",
  "Almost ready for your close-up…",
];

const TIPS = [
  "Tip: every slide's image is generated from your story + chosen genre.",
  "Tip: the palette is picked to match your tone — try a different genre for a new look.",
  "Tip: you can edit any slide's text and regenerate its image in the editor.",
  "Tip: a great logline is one sentence — hook, character, and stakes.",
];

export function GeneratingOverlay({ progress }: GeneratingOverlayProps) {
  const [stage, setStage] = useState(0);
  const [tip, setTip] = useState(0);

  useEffect(() => {
    const s = setInterval(() => setStage((i) => (i + 1) % STAGES.length), 2600);
    const t = setInterval(() => setTip((i) => (i + 1) % TIPS.length), 5200);
    return () => {
      clearInterval(s);
      clearInterval(t);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-surface-0/92 backdrop-blur-md">
      <div className="glass-panel-strong w-[min(92vw,30rem)] rounded-2xl p-10 text-center">
        {/* Film-reel style dual spinner */}
        <div className="relative mx-auto mb-7 h-16 w-16">
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-accent-neon/30 border-t-accent-neon" />
          <div className="absolute inset-2 animate-spin rounded-full border-2 border-accent-lime/20 border-b-accent-lime [animation-direction:reverse] [animation-duration:1.5s]" />
          <div className="absolute inset-0 flex items-center justify-center text-lg">🎬</div>
        </div>

        <p className="font-display text-xl font-semibold text-text-primary">
          Building your cinematic pitch deck…
        </p>

        <p
          key={stage}
          className="mt-3 min-h-[1.25rem] text-sm text-accent-neon transition-opacity duration-300"
        >
          {STAGES[stage]}
        </p>

        {typeof progress === "number" && progress > 0 && (
          <div className="mt-5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent-neon to-accent-lime transition-all duration-500"
                style={{ width: `${Math.max(5, Math.min(100, progress))}%` }}
              />
            </div>
            <p className="mt-1.5 text-right text-[11px] tabular-nums text-text-dim">
              {Math.round(progress)}%
            </p>
          </div>
        )}

        <p
          key={`tip-${tip}`}
          className="mt-6 border-t border-white/[0.06] pt-4 text-xs leading-relaxed text-text-dim transition-opacity duration-300"
        >
          {TIPS[tip]}
        </p>
      </div>
    </div>
  );
}
