"use client";

import type { PanelHandleProps } from "@/lib/use-panel";

/**
 * The draggable divider between workspace panels. ~8px invisible hit area with a
 * 1px line that doubles as the panel border; the line brightens on hover and
 * turns accent while dragging. Double-click resets the panel (wired via
 * handleProps), arrow keys resize for accessibility.
 */
export function ResizeHandle({
  dragging,
  className = "",
  ...handleProps
}: PanelHandleProps & { dragging: boolean; className?: string }) {
  const vertical = handleProps["aria-orientation"] === "vertical";
  return (
    <div
      {...handleProps}
      className={`group relative z-10 shrink-0 touch-none outline-none ${
        vertical ? "-mx-1 w-2 cursor-col-resize" : "-my-1 h-2 cursor-row-resize"
      } ${className}`}
    >
      <div
        className={`absolute transition-colors duration-150 ${
          vertical ? "inset-y-0 left-1/2 w-px -translate-x-1/2" : "inset-x-0 top-1/2 h-px -translate-y-1/2"
        } ${
          dragging
            ? "bg-accent-neon/80"
            : "bg-border-glass group-hover:bg-white/30 group-focus-visible:bg-accent-neon/60"
        }`}
      />
      {/* Wider glow while hovering/dragging so the affordance is visible without being loud. */}
      <div
        className={`absolute opacity-0 transition-opacity duration-150 group-hover:opacity-100 ${
          vertical ? "inset-y-0 left-1/2 w-[3px] -translate-x-1/2" : "inset-x-0 top-1/2 h-[3px] -translate-y-1/2"
        } ${dragging ? "bg-accent-neon/40 opacity-100" : "bg-white/15"}`}
      />
    </div>
  );
}
