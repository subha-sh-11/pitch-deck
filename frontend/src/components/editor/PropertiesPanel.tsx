"use client";

import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AddSlideMenu } from "@/features/preview/AddSlideMenu";
import type { DesignDirection } from "@/types/design";
import type { Slide, SlideType } from "@/types/slide";
import {
  SLIDE_STATUS_LABELS,
  SLIDE_TYPE_LABELS,
} from "@/types/slide";

interface PropertiesPanelProps {
  slide: Slide;
  slideIndex: number;
  totalSlides: number;
  designDirection: DesignDirection;
  onRegenerateContent: () => void;
  onRegenerateDesign: () => void;
  onDuplicate: () => void;
  onAddAfter: (type: SlideType) => void;
  onDelete: () => void;
  onMockAction: (message: string) => void;
  regenerating?: boolean;
}

function PanelSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-white/[0.06] py-4 last:border-b-0">
      <h4 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6b7280]">
        {title}
      </h4>
      {children}
    </section>
  );
}

export function PropertiesPanel({
  slide,
  slideIndex,
  totalSlides,
  designDirection,
  onRegenerateContent,
  onRegenerateDesign,
  onDuplicate,
  onAddAfter,
  onDelete,
  onMockAction,
  regenerating = false,
}: PropertiesPanelProps) {
  const [expandedPrompt, setExpandedPrompt] = useState(false);

  const imagePrompt = slide.imagePrompt ?? "";

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-l border-white/[0.08] bg-[#101010]">
      <div className="border-b border-white/[0.08] px-4 py-3">
        <h3 className="text-sm font-semibold text-[#F5F1E8]">Properties</h3>
        <p className="mt-0.5 text-[11px] text-[#6b7280]">
          Slide {slideIndex + 1} of {totalSlides}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4">
        <PanelSection title="Slide Info">
          <dl className="space-y-2.5 text-sm">
            <div>
              <dt className="text-[11px] text-[#6b7280]">Title</dt>
              <dd className="font-medium text-[#F5F1E8]">{slide.title}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-[#6b7280]">Type</dt>
              <dd className="mt-1">
                <Badge variant="neon">{SLIDE_TYPE_LABELS[slide.slideType]}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-[#6b7280]">Status</dt>
              <dd className="mt-1">
                <Badge variant="success">{SLIDE_STATUS_LABELS[slide.status]}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-[#6b7280]">Layout</dt>
              <dd className="text-[#9CA3AF]">{slide.layout.layoutType}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-[#6b7280]">Purpose</dt>
              <dd className="text-xs leading-relaxed text-[#9CA3AF]">{slide.purpose}</dd>
            </div>
          </dl>
        </PanelSection>

        <PanelSection title="Design System">
          <p className="mb-3 text-xs text-[#9CA3AF]">
            Mood: <span className="text-[#F5F1E8]">{designDirection.mood}</span>
          </p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {designDirection.palette.map((color) => (
              <span
                key={color.name}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] text-[#9CA3AF]"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full ring-1 ring-white/10"
                  style={{ backgroundColor: color.hex }}
                />
                {color.name}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-[#6b7280]">
            Typography: cinematic serif + clean sans
          </p>
          <p className="mt-1 text-[11px] text-[#6b7280]">
            Background: {designDirection.backgroundStyle}
          </p>
        </PanelSection>

        <PanelSection title="AI Actions">
          <div className="flex flex-col gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              disabled={regenerating}
              onClick={onRegenerateContent}
            >
              {regenerating ? "Regenerating…" : "Regenerate slide content"}
            </Button>
            <Button variant="ghost" size="sm" onClick={onRegenerateDesign}>
              Regenerate slide design
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMockAction("Improving visual hierarchy…")}
            >
              Improve visual hierarchy
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMockAction("Applying cinematic treatment…")}
            >
              Make more cinematic
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMockAction("Shortening slide text…")}
            >
              Shorten text
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMockAction("Image prompt copied to clipboard (mock)")}
            >
              Create image prompt
            </Button>
          </div>
        </PanelSection>

        <PanelSection title="Image Prompt Preview">
          <button
            type="button"
            onClick={() => setExpandedPrompt(!expandedPrompt)}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 text-left transition-colors hover:border-[#f8c9a4]/30"
          >
            <p
              className={`text-[11px] leading-relaxed text-[#9CA3AF] ${
                expandedPrompt ? "" : "line-clamp-3"
              }`}
            >
              {imagePrompt}
            </p>
            <span className="mt-2 block text-[10px] text-[#f8c9a4]">
              {expandedPrompt ? "Show less" : "Show more"}
            </span>
          </button>
        </PanelSection>

        <PanelSection title="Slide Actions">
          <div className="flex flex-col gap-1.5">
            <Button variant="ghost" size="sm" onClick={onDuplicate}>
              Duplicate slide
            </Button>
            <AddSlideMenu label="Add slide after" onAdd={onAddAfter} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMockAction("Template picker opened (mock)")}
            >
              Change template
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={totalSlides <= 1}
              onClick={onDelete}
              className="text-red-400/80 hover:text-red-400"
            >
              Delete slide
            </Button>
          </div>
        </PanelSection>
      </div>
    </aside>
  );
}
