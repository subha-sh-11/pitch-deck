"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getDeck } from "@/lib/api/deck";
import { projectRoutes } from "@/lib/routes";
import type { Deck } from "@/types/deck";
import type { QualityIssueSeverity, QualityReviewIssue } from "@/types/workflow";

// Severity → display order + colour. The agent docks a clean 100 by severity, so we mirror
// that weighting visually: high first, in the warmest tone.
const SEVERITY_ORDER: Record<QualityIssueSeverity, number> = { high: 0, medium: 1, low: 2 };
const SEVERITY_STYLE: Record<QualityIssueSeverity, { dot: string; chip: string; label: string }> = {
  high: { dot: "bg-red-400", chip: "bg-red-500/15 text-red-300", label: "High" },
  medium: { dot: "bg-amber-400", chip: "bg-amber-500/15 text-amber-300", label: "Medium" },
  low: { dot: "bg-sky-400", chip: "bg-sky-500/15 text-sky-300", label: "Low" },
};

const CATEGORY_LABELS: Record<string, string> = {
  repeated_images: "Repeated image",
  missing_producer_slide: "Missing slide",
  readability: "Readability",
  generic_copy: "Generic copy",
  character_consistency: "Characters",
  spelling: "Spelling",
  generic: "Generic copy",
  consistency: "Consistency",
  commercial: "Commercial case",
  clarity: "Clarity",
};

function scoreTone(score: number): { ring: string; text: string; verdict: string } {
  if (score >= 90) return { ring: "#34d399", text: "text-emerald-300", verdict: "Producer-ready" };
  if (score >= 70) return { ring: "#fbbf24", text: "text-amber-300", verdict: "Almost there" };
  return { ring: "#f87171", text: "text-red-300", verdict: "Needs work" };
}

export function ReviewStudio({ projectId }: { projectId: string }) {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [loadErr, setLoadErr] = useState(false);

  useEffect(() => {
    getDeck(projectId).then(setDeck).catch(() => setLoadErr(true));
  }, [projectId]);

  const review = deck?.qualityReview ?? null;

  // Slide number → title, so an issue can name the slide it's about.
  const slideTitle = useMemo(() => {
    const map = new Map<number, string>();
    for (const s of deck?.slides ?? []) map.set(s.slideNumber, s.title);
    return map;
  }, [deck]);

  const issues = useMemo(() => {
    const list = [...(review?.issues ?? [])];
    list.sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        (a.slideNumber ?? 99) - (b.slideNumber ?? 99),
    );
    return list;
  }, [review]);

  const counts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0 } as Record<QualityIssueSeverity, number>;
    for (const i of issues) c[i.severity] = (c[i.severity] ?? 0) + 1;
    return c;
  }, [issues]);

  return (
    <div className="min-h-screen bg-surface-0 text-text-primary">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border-glass bg-surface-0/80 px-6 py-3 backdrop-blur">
        <Link
          href={projectRoutes.editor(projectId)}
          className="rounded-md border border-white/15 px-3 py-1.5 text-sm font-medium transition hover:bg-white/10"
        >
          ← Back to deck
        </Link>
        <h1 className="font-display text-lg font-semibold">AI Quality Review</h1>
        <Link
          href={projectRoutes.export(projectId)}
          className="ml-auto rounded-md bg-accent-neon px-3.5 py-1.5 text-sm font-semibold text-zinc-950 transition hover:bg-accent-neon-dim"
        >
          Export deck →
        </Link>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        {loadErr ? (
          <p className="rounded-lg border border-border-glass bg-surface-1/40 p-6 text-sm text-text-dim">
            Couldn&apos;t load this deck&apos;s review.
          </p>
        ) : !deck ? (
          <div className="flex items-center gap-3 py-16 text-text-dim">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-accent-neon/30 border-t-accent-neon" />
            Loading review…
          </div>
        ) : !review ? (
          <EmptyState projectId={projectId} />
        ) : (
          <>
            <ScoreCard score={review.score} summary={review.summary} counts={counts} />

            {issues.length === 0 ? (
              <p className="mt-8 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] p-6 text-sm text-emerald-200">
                No issues found — this deck reads clean. You&apos;re ready to export.
              </p>
            ) : (
              <ul className="mt-8 space-y-3">
                {issues.map((issue, i) => (
                  <IssueRow
                    key={i}
                    issue={issue}
                    title={issue.slideNumber ? slideTitle.get(issue.slideNumber) : undefined}
                    projectId={projectId}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ScoreCard({
  score,
  summary,
  counts,
}: {
  score: number;
  summary: string;
  counts: Record<QualityIssueSeverity, number>;
}) {
  const tone = scoreTone(score);
  return (
    <div className="flex flex-col gap-6 rounded-xl border border-border-glass bg-surface-1/40 p-6 sm:flex-row sm:items-center">
      <div
        className="relative grid h-28 w-28 shrink-0 place-items-center rounded-full"
        style={{ background: `conic-gradient(${tone.ring} ${score * 3.6}deg, rgba(255,255,255,0.08) 0deg)` }}
      >
        <div className="grid h-[88px] w-[88px] place-items-center rounded-full bg-surface-0">
          <span className={`font-display text-3xl font-bold ${tone.text}`}>{score}</span>
        </div>
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-semibold uppercase tracking-wider ${tone.text}`}>{tone.verdict}</p>
        <p className="mt-1 text-sm leading-relaxed text-text-muted">{summary}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {(["high", "medium", "low"] as const).map((sev) =>
            counts[sev] ? (
              <span key={sev} className={`rounded-full px-2.5 py-1 font-medium ${SEVERITY_STYLE[sev].chip}`}>
                {counts[sev]} {SEVERITY_STYLE[sev].label.toLowerCase()}
              </span>
            ) : null,
          )}
        </div>
      </div>
    </div>
  );
}

function IssueRow({
  issue,
  title,
  projectId,
}: {
  issue: QualityReviewIssue;
  title?: string;
  projectId: string;
}) {
  const style = SEVERITY_STYLE[issue.severity];
  const category = CATEGORY_LABELS[issue.category] ?? issue.category;
  return (
    <li className="flex gap-3 rounded-lg border border-border-glass bg-surface-1/30 p-4">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${style.chip}`}>
            {category}
          </span>
          {issue.slideNumber ? (
            <span className="text-xs text-text-dim">
              Slide {issue.slideNumber}
              {title ? ` · ${title}` : ""}
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{issue.message}</p>
      </div>
      <Link
        href={projectRoutes.editor(projectId)}
        className="self-center rounded-md border border-white/15 px-2.5 py-1 text-xs font-medium text-text-primary transition hover:bg-white/10"
      >
        Fix
      </Link>
    </li>
  );
}

function EmptyState({ projectId }: { projectId: string }) {
  return (
    <div className="rounded-xl border border-border-glass bg-surface-1/40 p-8 text-center">
      <p className="font-display text-xl text-text-muted">No review yet</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-text-dim">
        The quality review runs automatically when a deck is generated. Build or regenerate the
        deck to get a structural QA pass.
      </p>
      <Link
        href={projectRoutes.editor(projectId)}
        className="mt-5 inline-block rounded-full bg-accent-neon px-5 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-accent-neon-dim"
      >
        Go to deck
      </Link>
    </div>
  );
}
