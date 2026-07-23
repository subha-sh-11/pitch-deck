"use client";

import { useEffect, useRef, useState } from "react";
import { SlideThumbnailPreview } from "@/components/slides/SlideThumbnailPreview";
import type { DesignDirection } from "@/types/design";
import type { Slide } from "@/types/slide";

// The bottom slide navigator: numbered, titled thumbnails that can be dragged to
// reorder, a resizable height (the handle lives in DeckStage), and a 32px
// collapsed bar for when the director wants the canvas.
export function Filmstrip({
  slides,
  selectedId,
  design,
  generating,
  isSlideGenerating,
  height,
  collapsed,
  onToggleCollapsed,
  onSelect,
  onDelete,
  onAddEnd,
  onReorder,
  removedCount,
  onOpenBin,
}: {
  slides: Slide[];
  selectedId: string;
  design: DesignDirection;
  generating: boolean;
  isSlideGenerating: (slide: Slide, generating: boolean) => boolean;
  height: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onAddEnd: () => void;
  onReorder: (from: number, to: number) => void;
  removedCount: number;
  onOpenBin: () => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  // Insertion point (0..slides.length) while a thumbnail is dragged over the strip.
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const thumbRefs = useRef(new Map<string, HTMLDivElement>());
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Dragging near either end of the strip scrolls it, so long decks can be
  // reordered across more than one screenful of thumbnails.
  const autoScrollNearEdges = (clientX: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const EDGE = 56;
    if (clientX < rect.left + EDGE) el.scrollLeft -= 14;
    else if (clientX > rect.right - EDGE) el.scrollLeft += 14;
  };

  // Keep the selected thumbnail in view when navigating by keyboard / canvas.
  useEffect(() => {
    thumbRefs.current.get(selectedId)?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [selectedId]);

  const curIndex = Math.max(0, slides.findIndex((s) => s.id === selectedId));

  if (collapsed) {
    return (
      <div className="flex h-8 shrink-0 items-center gap-3 bg-surface-1/60 px-3 text-xs text-text-dim">
        <span>
          Slides · {slides.length}
          <span className="ml-2 text-text-muted">viewing {curIndex + 1}</span>
        </span>
        {removedCount > 0 && (
          <button
            type="button"
            onClick={onOpenBin}
            className="rounded px-1.5 py-0.5 transition-colors hover:bg-surface-2 hover:text-text-primary"
            title="Restore removed slides"
          >
            Removed ({removedCount})
          </button>
        )}
        <button
          type="button"
          onClick={onToggleCollapsed}
          title="Expand the filmstrip"
          className="ml-auto flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-surface-2 hover:text-text-primary"
        >
          <Chevron up />
        </button>
      </div>
    );
  }

  // Height budget: strip padding (16) + caption row (~20) — the rest is thumbnail.
  const thumbH = Math.max(54, height - 16 - 20);
  const thumbW = Math.round((thumbH * 16) / 9);

  const commitDrop = () => {
    if (dragIdx != null && overIdx != null) {
      const to = overIdx > dragIdx ? overIdx - 1 : overIdx;
      if (to !== dragIdx) onReorder(dragIdx, to);
    }
    setDragIdx(null);
    setOverIdx(null);
  };

  return (
    <div style={{ height }} className="flex shrink-0 bg-surface-1/60">
      <div
        ref={scrollerRef}
        className="flex min-w-0 flex-1 items-center overflow-x-auto overflow-y-hidden px-3 [scrollbar-width:thin]"
        onDragOver={(e) => {
          // Allow dropping in the empty area after the last thumb.
          if (dragIdx != null) {
            e.preventDefault();
            setOverIdx(slides.length);
            autoScrollNearEdges(e.clientX);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          commitDrop();
        }}
      >
        <div className="mx-auto flex items-start gap-3 py-2">
          {slides.map((s, i) => {
            const active = s.id === selectedId;
            return (
              <div
                key={s.id}
                ref={(el) => {
                  if (el) thumbRefs.current.set(s.id, el);
                  else thumbRefs.current.delete(s.id);
                }}
                style={{ width: thumbW }}
                className={`group relative shrink-0 transition-[opacity,translate] duration-150 ${
                  dragIdx === i ? "-translate-y-0.5 opacity-85" : ""
                }`}
                draggable
                onDragStart={(e) => {
                  setDragIdx(i);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", String(i));
                }}
                onDragOver={(e) => {
                  if (dragIdx == null) return;
                  e.preventDefault();
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setOverIdx(e.clientX < rect.left + rect.width / 2 ? i : i + 1);
                  autoScrollNearEdges(e.clientX);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  commitDrop();
                }}
                onDragEnd={() => {
                  setDragIdx(null);
                  setOverIdx(null);
                }}
              >
                {/* Insertion marker while dragging */}
                {overIdx === i && dragIdx != null && (
                  <span className="absolute -left-[7px] top-0 z-20 w-[2px] rounded bg-accent-neon" style={{ height: thumbH }} />
                )}
                {overIdx === i + 1 && dragIdx != null && i === slides.length - 1 && (
                  <span className="absolute -right-[7px] top-0 z-20 w-[2px] rounded bg-accent-neon" style={{ height: thumbH }} />
                )}
                <button
                  type="button"
                  onClick={() => onSelect(s.id)}
                  title={`${i + 1} · ${s.title || s.slideType} — drag to reorder`}
                  className={`relative block w-full overflow-hidden rounded-lg border-2 transition-[border-color,box-shadow,opacity] ${
                    active
                      ? "border-accent-neon shadow-[0_0_0_1px_rgba(248,201,164,0.35),0_0_16px_rgba(248,201,164,0.18)]"
                      : "border-transparent opacity-75 hover:border-white/30 hover:opacity-100"
                  }`}
                  style={{ height: thumbH }}
                >
                  <SlideThumbnailPreview slide={s} designDirection={design} />
                  {isSlideGenerating(s, generating) && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/55">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent-neon/40 border-t-accent-neon" />
                    </span>
                  )}
                </button>
                <div className="mt-1 flex items-center gap-1.5 px-0.5">
                  <span
                    className={`flex h-4 min-w-4 shrink-0 items-center justify-center rounded px-1 text-[10px] font-semibold ${
                      active ? "bg-accent-neon text-zinc-950" : "text-text-dim"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span
                    className={`min-w-0 truncate text-[11px] ${
                      active ? "font-medium text-text-primary" : "text-text-dim"
                    }`}
                  >
                    {s.title || s.slideType}
                  </span>
                </div>
                {/* Remove → recycle bin (restorable). Hidden until hover. */}
                {slides.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(s.id);
                    }}
                    title="Remove slide (restore from Removed)"
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-xs text-white/90 opacity-0 transition-opacity hover:bg-red-500/90 group-hover:opacity-100"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
          {/* Add a new slide at the end of the deck. */}
          <button
            type="button"
            onClick={onAddEnd}
            title="Add a new slide to the end"
            style={{ width: thumbW, height: thumbH }}
            className="flex shrink-0 flex-col items-center justify-center gap-0.5 self-start rounded-lg border-2 border-dashed border-white/15 text-text-dim transition-colors hover:border-accent-neon/50 hover:text-text-primary"
          >
            <span className="text-xl leading-none">＋</span>
            <span className="text-[10px] uppercase tracking-wider">Add slide</span>
          </button>
        </div>
      </div>

      {/* Strip-scoped controls */}
      <div className="flex shrink-0 flex-col items-center justify-between py-1.5 pl-1 pr-2">
        <button
          type="button"
          onClick={onToggleCollapsed}
          title="Collapse the filmstrip"
          className="flex h-6 w-6 items-center justify-center rounded text-text-dim transition-colors hover:bg-surface-2 hover:text-text-primary"
        >
          <Chevron />
        </button>
        {removedCount > 0 && (
          <button
            type="button"
            onClick={onOpenBin}
            title="Restore removed slides"
            className="flex h-6 w-6 items-center justify-center rounded text-text-dim transition-colors hover:bg-surface-2 hover:text-text-primary"
          >
            <BinIcon />
            <span className="sr-only">Removed ({removedCount})</span>
          </button>
        )}
      </div>
    </div>
  );
}

function Chevron({ up = false }: { up?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={up ? "rotate-180" : ""}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function BinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 .9h8a1 1 0 0 0 1-.9L18 7" />
    </svg>
  );
}
