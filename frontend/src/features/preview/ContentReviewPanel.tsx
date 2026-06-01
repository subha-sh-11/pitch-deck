"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import type { Slide, SlideType } from "@/types/slide";
import { SLIDE_TYPE_LABELS } from "@/types/slide";
import { AddSlideMenu } from "./AddSlideMenu";
import {
  assessSlideContentReliability,
  type ContentReliabilityStatus,
} from "./content-reliability";

interface ContentReviewPanelProps {
  slide: Slide;
  slideIndex: number;
  totalSlides: number;
  bodyText: string;
  onBodyChange: (text: string) => void;
  onBodyBlur: () => void;
  onHeadingChange: (heading: string) => void;
  onSubheadingChange?: (subheading: string) => void;
  onFooterChange?: (footer: string) => void;
  onRegenerateAi: () => void;
  onMarkReliable: () => void;
  onDelete: () => void;
  onAddAfter: (type: SlideType) => void;
  regenerating: boolean;
  canDelete: boolean;
  markedReliable: boolean;
}

const reliabilityStyles: Record<
  ContentReliabilityStatus,
  { badge: "success" | "warning" | "muted"; border: string }
> = {
  reliable: { badge: "success", border: "border-emerald-500/25 bg-emerald-500/[0.06]" },
  needs_review: { badge: "warning", border: "border-amber-500/25 bg-amber-500/[0.06]" },
  weak: { badge: "muted", border: "border-red-500/25 bg-red-500/[0.06]" },
};

export function ContentReviewPanel({
  slide,
  slideIndex,
  totalSlides,
  bodyText,
  onBodyChange,
  onBodyBlur,
  onHeadingChange,
  onSubheadingChange,
  onFooterChange,
  onRegenerateAi,
  onMarkReliable,
  onDelete,
  onAddAfter,
  regenerating,
  canDelete,
  markedReliable,
}: ContentReviewPanelProps) {
  const reliability = assessSlideContentReliability(slide);
  const style = reliabilityStyles[reliability.status];

  return (
    <div className="preview-scroll flex h-full min-h-0 flex-col gap-4 pr-1">
      <div className="shrink-0">
        <p className="text-[11px] font-medium text-[#6b7280]">
          Slide {slideIndex + 1} of {totalSlides} · {SLIDE_TYPE_LABELS[slide.slideType]}
        </p>
        <h2 className="mt-1 font-display text-2xl font-semibold text-[#F5F1E8]">{slide.title}</h2>
        <p className="mt-2 text-xs leading-relaxed text-[#6b7280]">
          <span className="text-[#9CA3AF]">Purpose:</span> {slide.purpose}
        </p>
      </div>

      <section className={`shrink-0 rounded-2xl border p-5 ${style.border}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[#F5F1E8]">{reliability.headline}</h3>
              <Badge variant={style.badge}>{reliability.score}% match</Badge>
              {markedReliable && (
                <Badge variant="success">You approved</Badge>
              )}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-[#9CA3AF]">{reliability.summary}</p>
          </div>
        </div>

        <ul className="mt-4 space-y-2">
          {reliability.checks.map((check) => (
            <li key={check.label} className="flex items-start gap-2 text-xs">
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
                  check.pass
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-red-500/15 text-red-400"
                }`}
              >
                {check.pass ? "✓" : "!"}
              </span>
              <span className={check.pass ? "text-[#9CA3AF]" : "text-[#F5F1E8]"}>
                {check.label}
              </span>
            </li>
          ))}
        </ul>

        {reliability.aiSuggestion && reliability.status !== "reliable" && (
          <p className="mt-4 rounded-lg bg-black/20 px-3 py-2 text-xs italic text-[#22d3ee]/90">
            AI tip: {reliability.aiSuggestion}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="primary"
            size="sm"
            disabled={regenerating}
            onClick={onRegenerateAi}
          >
            {regenerating ? "Regenerating…" : "Regenerate with AI"}
          </Button>
          {reliability.status !== "reliable" && (
            <Button variant="outline" size="sm" onClick={onMarkReliable}>
              Mark as reliable
            </Button>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6b7280]">
          Edit content
        </h3>
        <p className="mt-1 mb-4 text-xs text-[#6b7280]">
          Change copy below if anything feels off-topic or incomplete.
        </p>

        <div className="space-y-4">
          <Textarea
            label="Heading"
            value={slide.content.heading}
            onChange={(e) => onHeadingChange(e.target.value)}
            rows={2}
            className="min-h-[52px] resize-none"
          />

          {slide.content.subheading !== undefined && onSubheadingChange && (
            <Textarea
              label="Tagline / subheading"
              value={slide.content.subheading ?? ""}
              onChange={(e) => onSubheadingChange(e.target.value)}
              rows={2}
              className="min-h-[52px] resize-none"
            />
          )}

          <Textarea
            label="Main content"
            value={bodyText}
            onChange={(e) => onBodyChange(e.target.value)}
            onBlur={onBodyBlur}
            rows={10}
            className="min-h-[200px] font-mono text-[13px] leading-relaxed"
            helperText="Body text, bullets (one per line), or structured copy for this slide."
          />

          {slide.content.footer !== undefined && onFooterChange && (
            <Textarea
              label="Footer"
              value={slide.content.footer ?? ""}
              onChange={(e) => onFooterChange(e.target.value)}
              rows={2}
              className="min-h-[52px] resize-none"
            />
          )}
        </div>
      </section>

      <section className="shrink-0 rounded-xl border border-white/[0.04] bg-transparent px-1 pb-2">
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" disabled={!canDelete} onClick={onDelete}>
            Delete slide
          </Button>
          <AddSlideMenu onAdd={onAddAfter} label="Add slide after" />
        </div>
      </section>
    </div>
  );
}
