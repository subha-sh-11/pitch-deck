"use client";

import type { Slide } from "@/types/slide";
import { formatSlidePreviewBlocks } from "./format-slide-content";

interface SlideContentCardsProps {
  slide: Slide;
}

export function SlideContentCards({ slide }: SlideContentCardsProps) {
  const { slideType, content } = slide;
  const blocks = formatSlidePreviewBlocks(slide);

  if (slideType === "cover") {
    const title = blocks.find((b) => b.label === "Title");
    const tagline = blocks.find((b) => b.label === "Tagline");
    const subtitle = blocks.find((b) => b.label === "Subtitle");
    const credit = blocks.find((b) => b.label === "Credit");
    return (
      <div className="preview-fade-in space-y-3">
        <div className="preview-content-block p-5">
          <p className="text-xs text-zinc-500">Title</p>
          <p className="mt-1 font-display text-2xl font-semibold text-zinc-100 md:text-3xl">
            {title?.value ?? content.heading}
          </p>
          {tagline && (
            <p className="mt-2 font-display text-base italic text-zinc-400">
              {tagline.value}
            </p>
          )}
        </div>
        {subtitle && (
          <div className="preview-content-block p-4">
            <p className="text-xs text-zinc-500">Subtitle</p>
            <p className="mt-1 text-sm leading-relaxed text-zinc-300">{subtitle.value}</p>
          </div>
        )}
        {credit && <p className="text-xs text-zinc-600">{credit.value}</p>}
      </div>
    );
  }

  if (slideType === "logline") {
    const text = content.body ?? blocks[0]?.value ?? "";
    return (
      <div className="preview-fade-in">
        <blockquote className="preview-content-block relative py-5 pl-6 pr-4">
          <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-zinc-600" />
          <p className="font-display text-lg leading-relaxed text-zinc-200 md:text-xl">
            {text}
          </p>
        </blockquote>
      </div>
    );
  }

  if (content.moodBlocks?.length) {
    return (
      <div className="preview-fade-in space-y-3">
        {content.body && (
          <p className="text-sm leading-relaxed text-zinc-400">{content.body}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {content.moodBlocks.map((m) => (
            <div
              key={m.label}
              className="preview-content-block flex items-center gap-2 px-3 py-2"
            >
              <span
                className="h-4 w-4 rounded border border-zinc-700"
                style={{ backgroundColor: m.color }}
              />
              <span className="text-xs text-zinc-500">{m.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (content.characters?.length) {
    return (
      <div className="preview-fade-in grid gap-2 sm:grid-cols-2">
        {content.characters.map((c) => (
          <div key={c.name} className="preview-content-block p-4">
            <p className="font-medium text-zinc-200">{c.name}</p>
            {c.role && <p className="mt-0.5 text-xs text-zinc-500">{c.role}</p>}
            <p className="mt-2 text-xs leading-relaxed text-zinc-400">{c.description}</p>
          </div>
        ))}
      </div>
    );
  }

  if (content.comps?.length) {
    return (
      <div className="preview-fade-in space-y-3">
        {content.body && (
          <p className="text-sm text-zinc-400">{content.body}</p>
        )}
        <div className="grid gap-2 sm:grid-cols-3">
          {content.comps.map((comp) => (
            <div key={comp.title} className="preview-content-block p-3">
              <p className="text-sm font-medium text-zinc-200">{comp.title}</p>
              <p className="mt-1 text-xs text-zinc-500">{comp.note}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (content.items?.length) {
    return (
      <div className="preview-fade-in grid gap-2 sm:grid-cols-2">
        {content.items.map((item) => (
          <div key={item.title} className="preview-content-block p-4">
            <p className="text-sm font-medium text-zinc-200">{item.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">{item.description}</p>
          </div>
        ))}
      </div>
    );
  }

  if (content.bullets?.length) {
    return (
      <div className="preview-fade-in space-y-2">
        {content.bullets.map((bullet, i) => (
          <div key={i} className="preview-content-block px-4 py-3">
            <p className="text-sm text-zinc-300">{bullet}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="preview-fade-in space-y-2">
      {blocks.map((block) => (
        <div key={block.label} className="preview-content-block p-4">
          <p className="text-xs text-zinc-500">{block.label}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-300">{block.value}</p>
        </div>
      ))}
    </div>
  );
}
