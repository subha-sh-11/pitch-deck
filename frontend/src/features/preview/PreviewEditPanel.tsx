"use client";

import type { ReactNode } from "react";
import { SlideRenderer } from "@/components/slides/SlideRenderer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { useSetupWizard } from "@/features/setup/SetupWizardContext";
import type { Slide, SlideType } from "@/types/slide";
import { SLIDE_STATUS_LABELS, SLIDE_TYPE_LABELS } from "@/types/slide";
import { AddSlideMenu } from "./AddSlideMenu";

interface PreviewEditPanelProps {
  slide: Slide;
  slideIndex: number;
  totalSlides: number;
  bodyText: string;
  onBodyChange: (text: string) => void;
  onBodyBlur: () => void;
  onHeadingChange: (heading: string) => void;
  onSubheadingChange?: (subheading: string) => void;
  onFooterChange?: (footer: string) => void;
  onRegenerate: () => void;
  onDelete: () => void;
  onAddAfter: (type: SlideType) => void;
  regenerating: boolean;
  canDelete: boolean;
}

function SectionBlock({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="mb-4 border-b border-white/[0.04] pb-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6b7280]">
          {title}
        </h3>
        {description && (
          <p className="mt-1.5 text-xs leading-relaxed text-[#6b7280]">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

export function PreviewEditPanel({
  slide,
  slideIndex,
  totalSlides,
  bodyText,
  onBodyChange,
  onBodyBlur,
  onHeadingChange,
  onSubheadingChange,
  onFooterChange,
  onRegenerate,
  onDelete,
  onAddAfter,
  regenerating,
  canDelete,
}: PreviewEditPanelProps) {
  const { designDirection } = useSetupWizard();
  return (
    <div className="preview-scroll flex h-full min-h-0 flex-col gap-4 pr-1">
      <section className="shrink-0 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-[#6b7280]">
              Slide {slideIndex + 1} of {totalSlides}
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-[#F5F1E8]">
              {slide.title}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#9CA3AF]">
              {slide.purpose}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="neon">{SLIDE_TYPE_LABELS[slide.slideType]}</Badge>
            <Badge variant="muted">{SLIDE_STATUS_LABELS[slide.status]}</Badge>
          </div>
        </div>
      </section>

      <SectionBlock title="Live preview" description="How this slide will appear in your deck.">
        <div className="overflow-hidden rounded-xl ring-1 ring-white/[0.08]">
          <SlideRenderer
            slide={slide}
            designDirection={designDirection ?? undefined}
            className="rounded-none"
          />
        </div>
      </SectionBlock>

      <SectionBlock title="Heading" description="Primary title or label on the slide.">
        <Textarea
          label=""
          value={slide.content.heading}
          onChange={(e) => onHeadingChange(e.target.value)}
          rows={2}
          className="min-h-[52px] resize-none"
        />
      </SectionBlock>

      {slide.content.subheading !== undefined && onSubheadingChange && (
        <SectionBlock title="Tagline" description="Secondary line under the title.">
          <Textarea
            label=""
            value={slide.content.subheading ?? ""}
            onChange={(e) => onSubheadingChange(e.target.value)}
            rows={2}
            className="min-h-[52px] resize-none"
          />
        </SectionBlock>
      )}

      <SectionBlock
        title="Content"
        description="Body copy, bullets, or supporting text for this slide."
      >
        <Textarea
          label=""
          value={bodyText}
          onChange={(e) => onBodyChange(e.target.value)}
          onBlur={onBodyBlur}
          rows={8}
          className="min-h-[160px]"
        />
      </SectionBlock>

      {slide.content.footer !== undefined && onFooterChange && (
        <SectionBlock title="Footer" description="Credits or closing line.">
          <Textarea
            label=""
            value={slide.content.footer ?? ""}
            onChange={(e) => onFooterChange(e.target.value)}
            rows={2}
            className="min-h-[52px] resize-none"
          />
        </SectionBlock>
      )}

      <SectionBlock title="Slide actions" description="Regenerate, reorder, or remove this slide.">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={regenerating}
            onClick={onRegenerate}
          >
            {regenerating ? "Regenerating…" : "Regenerate slide"}
          </Button>
          <Button variant="ghost" size="sm" disabled={!canDelete} onClick={onDelete}>
            Delete slide
          </Button>
          <AddSlideMenu onAdd={onAddAfter} label="Add slide after" />
        </div>
      </SectionBlock>
    </div>
  );
}
