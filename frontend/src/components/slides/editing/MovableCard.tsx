"use client";

import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import type { CardGeom } from "@/types/slide";
import { useSlideEdit } from "./SlideEditContext";

const MIN_W = 12; // %
const MIN_H = 12; // %

// 8 resize handles: 4 corners + 4 edge midpoints. `dir` drives which edges move; `cls` positions
// the handle and sets the resize cursor.
const RESIZE_HANDLES: { dir: string; cls: string }[] = [
  { dir: "nw", cls: "-left-1 -top-1 cursor-nw-resize" },
  { dir: "n", cls: "-top-1 left-1/2 -translate-x-1/2 cursor-n-resize" },
  { dir: "ne", cls: "-right-1 -top-1 cursor-ne-resize" },
  { dir: "e", cls: "-right-1 top-1/2 -translate-y-1/2 cursor-e-resize" },
  { dir: "se", cls: "-bottom-1 -right-1 cursor-se-resize" },
  { dir: "s", cls: "-bottom-1 left-1/2 -translate-x-1/2 cursor-s-resize" },
  { dir: "sw", cls: "-bottom-1 -left-1 cursor-sw-resize" },
  { dir: "w", cls: "-left-1 top-1/2 -translate-y-1/2 cursor-w-resize" },
];

/**
 * Wraps a card so the director can drag it anywhere on the slide and resize it from the corner —
 * a free-canvas block (Canva style). The first drag/resize "pops" the card out of the grid by
 * capturing its current rect; after that it's absolutely positioned (in container-query units so
 * it scales with the slide). Geometry persists in content.cardLayout, so the preview/export match.
 * Inner text/toolbars stopPropagation, so those interactions still work; only empty card area drags.
 */
export function MovableCard({
  ck,
  className = "",
  style,
  children,
}: {
  ck: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const { editing, cardLayout, setCardGeom } = useSlideEdit();
  const geom = cardLayout[ck];
  const ref = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState<CardGeom | null>(null);
  const op = useRef<{ mode: "move" | "resize"; dir: string; x: number; y: number; base: CardGeom; rootW: number; rootH: number; moved: boolean } | null>(null);

  // Positioning is relative to the card's offset parent (the nearest positioned ancestor) using %
  // units — so measurement and placement share the SAME containing block regardless of how deeply
  // the card is nested, and it scales with the slide.
  const parentRect = () => (ref.current?.offsetParent as HTMLElement | null)?.getBoundingClientRect() ?? null;

  // The geometry in effect right now (live drag wins, else stored).
  const eff = live ?? geom;
  const posStyle: CSSProperties = eff
    ? {
        position: "absolute",
        left: `${eff.xPct}%`,
        top: `${eff.yPct}%`,
        width: `${eff.wPct}%`,
        height: `${eff.hPct}%`,
        zIndex: live ? 40 : 20,
      }
    : {};

  // Capture the card's current on-screen rect as its starting geometry (first pop-out from grid).
  const currentGeom = (): CardGeom | null => {
    const rr = parentRect();
    const cr = ref.current?.getBoundingClientRect();
    if (!rr || !cr || !rr.width || !rr.height) return null;
    return {
      xPct: ((cr.left - rr.left) / rr.width) * 100,
      yPct: ((cr.top - rr.top) / rr.height) * 100,
      wPct: (cr.width / rr.width) * 100,
      hPct: (cr.height / rr.height) * 100,
    };
  };

  const start = (mode: "move" | "resize", dir = "") => (e: ReactPointerEvent) => {
    if (!editing) return;
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const rr = parentRect();
    const base = geom ?? currentGeom();
    if (!rr || !base) return;
    // Don't setLive yet — a plain click must NOT pop the card out of the grid. We commit only
    // once the pointer actually moves past a small threshold.
    op.current = { mode, dir, x: e.clientX, y: e.clientY, base, rootW: rr.width, rootH: rr.height, moved: false };
  };

  const onMove = (e: ReactPointerEvent) => {
    const o = op.current;
    if (!o) return;
    const dxPct = ((e.clientX - o.x) / o.rootW) * 100;
    const dyPct = ((e.clientY - o.y) / o.rootH) * 100;
    if (!o.moved && Math.hypot(e.clientX - o.x, e.clientY - o.y) < 4) return;
    o.moved = true;
    if (o.mode === "move") {
      setLive({
        ...o.base,
        xPct: Math.max(0, Math.min(100 - o.base.wPct, o.base.xPct + dxPct)),
        yPct: Math.max(0, Math.min(100 - o.base.hPct, o.base.yPct + dyPct)),
      });
    } else {
      // Resize from any edge/corner. The direction string carries n/s and w/e components.
      let { xPct, yPct, wPct, hPct } = o.base;
      const d = o.dir;
      if (d.includes("e")) wPct = Math.max(MIN_W, Math.min(100 - o.base.xPct, o.base.wPct + dxPct));
      if (d.includes("s")) hPct = Math.max(MIN_H, Math.min(100 - o.base.yPct, o.base.hPct + dyPct));
      if (d.includes("w")) {
        const nx = Math.min(o.base.xPct + o.base.wPct - MIN_W, Math.max(0, o.base.xPct + dxPct));
        wPct = o.base.wPct + (o.base.xPct - nx);
        xPct = nx;
      }
      if (d.includes("n")) {
        const ny = Math.min(o.base.yPct + o.base.hPct - MIN_H, Math.max(0, o.base.yPct + dyPct));
        hPct = o.base.hPct + (o.base.yPct - ny);
        yPct = ny;
      }
      setLive({ xPct, yPct, wPct, hPct });
    }
  };

  const end = (e: ReactPointerEvent) => {
    const o = op.current;
    op.current = null;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (o?.moved && live) setCardGeom(ck, live); // only persist a real drag/resize, not a click
    setLive(null);
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{ ...style, ...posStyle }}
      onPointerDown={start("move")}
      onPointerMove={onMove}
      onPointerUp={end}
    >
      {children}
      {editing && (
        <>
          {/* Drag affordance (top-left) + reset-to-grid on double-click. */}
          <span
            data-slide-toolbar
            title="Drag to move · double-click to snap back to the grid"
            onPointerDown={start("move")}
            onDoubleClick={(e) => { e.stopPropagation(); setCardGeom(ck, null); }}
            className="absolute left-1.5 top-1.5 z-30 flex h-6 w-6 cursor-move items-center justify-center rounded bg-black/70 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
          >
            ✥
          </span>
          {/* Resize handles on every corner AND edge midpoint — drag any of them. */}
          {RESIZE_HANDLES.map((h) => (
            <span
              key={h.dir}
              data-slide-toolbar
              title="Drag to resize"
              onPointerDown={start("resize", h.dir)}
              onPointerMove={onMove}
              onPointerUp={end}
              className={`absolute z-30 h-3 w-3 rounded-sm border border-white/60 bg-accent-neon/80 opacity-0 transition-opacity group-hover:opacity-100 ${h.cls}`}
            />
          ))}
        </>
      )}
    </div>
  );
}
