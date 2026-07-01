"use client";

import { useEffect, useState } from "react";
import { getProject } from "@/lib/api";
import { analyzeStory } from "@/lib/api/generation";
import type { StoryAnalysis } from "@/types/workflow";

// Design Bible step 3: show the AI's understanding of the film (theme, world, commercial angle)
// as an editable/reviewable read-back BEFORE building, so the director can catch a misread early.
const FIELDS: { key: keyof StoryAnalysis; label: string }[] = [
  { key: "coreTheme", label: "Core theme" },
  { key: "emotionalCore", label: "Emotional core" },
  { key: "storyWorld", label: "Story world" },
  { key: "commercialAngle", label: "Commercial angle" },
  { key: "audiencePromise", label: "Audience promise" },
  { key: "visualWorld", label: "Visual world" },
  { key: "pitchPositioning", label: "Pitch positioning" },
];

export function StoryBlueprint({ projectId, canAnalyze }: { projectId: string; canAnalyze: boolean }) {
  const [analysis, setAnalysis] = useState<StoryAnalysis | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    getProject(projectId)
      .then((p) => {
        if (p.storyAnalysis) setAnalysis(p.storyAnalysis as unknown as StoryAnalysis);
      })
      .catch(() => {});
  }, [projectId]);

  const run = async () => {
    setLoading(true);
    setErr("");
    setOpen(true);
    try {
      setAnalysis(await analyzeStory(projectId));
    } catch {
      setErr("Couldn't read your story yet — add a little more (logline or synopsis) and retry.");
    } finally {
      setLoading(false);
    }
  };

  const genreDna = Array.isArray(analysis?.genreDna) ? analysis!.genreDna : [];

  return (
    <div className="m-2 mb-0 shrink-0 rounded-xl border border-border-glass bg-surface-1/25">
      <header className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted transition hover:text-text-primary"
        >
          <span className={`transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
          {analysis ? "AI Understanding" : canAnalyze ? "Analyze my story" : "Story analysis will appear here"}
        </button>
        {analysis && !open && (
          <span className="truncate text-xs text-text-dim">· {analysis.coreTheme}</span>
        )}
        <button
          type="button"
          onClick={run}
          disabled={!canAnalyze || loading}
          className="ml-auto rounded-md border border-white/15 px-2.5 py-1 text-xs font-medium text-text-primary transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Reading…" : analysis ? "Re-analyze" : "Analyze my story"}
        </button>
      </header>

      {open && (
        <div className="border-t border-border-glass px-3 py-3">
          {err && <p className="mb-2 text-xs text-red-300">{err}</p>}
          {!analysis && !loading && !err && (
            <p className="text-xs leading-relaxed text-text-muted">
              See how the AI reads your film before building the deck. Click{" "}
              <span className="text-text-primary">Analyze my story</span> to generate a quick blueprint
              (theme, world, commercial angle) you can sanity-check.
            </p>
          )}
          {analysis && (
            <div className="space-y-2.5">
              {genreDna.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {genreDna.map((g, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-accent-neon/15 px-2 py-0.5 text-[11px] font-medium text-accent-neon"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}
              {FIELDS.map(({ key, label }) => {
                const val = analysis[key];
                if (typeof val !== "string" || !val.trim()) return null;
                return (
                  <div key={key} className="grid grid-cols-[110px_1fr] gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-text-dim">
                      {label}
                    </span>
                    <span className="text-xs leading-relaxed text-text-muted">{val}</span>
                  </div>
                );
              })}
              <p className="pt-1 text-[11px] text-text-dim">
                Misread something? Edit the brief below, then re-analyze or just build — the deck uses
                your edits.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
