"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ── Resizable workspace panels ────────────────────────────────────────────
// One hook per panel (chat rail, inspector, filmstrip). Size + collapsed state
// persist per panel in localStorage so the workspace comes back the way the
// director left it. Dragging is pointer-captured on the ResizeHandle; a
// double-click on the handle resets the panel to its default size.

export interface PanelOptions {
  /** localStorage key suffix — unique per panel. */
  key: string;
  defaultSize: number;
  min: number;
  max: number;
  /** Which workspace edge the panel hugs — decides which way a drag grows it. */
  side: "left" | "right" | "bottom";
  defaultCollapsed?: boolean;
  /** Cap the panel to this fraction of the viewport so the canvas keeps room (default 0.4). */
  viewportFraction?: number;
}

export interface PanelHandleProps {
  role: "separator";
  tabIndex: number;
  "aria-orientation": "vertical" | "horizontal";
  "aria-valuenow": number;
  "aria-valuemin": number;
  "aria-valuemax": number;
  "aria-label": string;
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLElement>) => void;
  onDoubleClick: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
}

export interface Panel {
  size: number;
  collapsed: boolean;
  dragging: boolean;
  setSize: (px: number) => void;
  setCollapsed: (v: boolean) => void;
  toggle: () => void;
  reset: () => void;
  handleProps: PanelHandleProps;
}

const STORAGE_PREFIX = "deck-workspace:";

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export function usePanel(opts: PanelOptions): Panel {
  const { key, defaultSize, min, max, side, defaultCollapsed = false, viewportFraction = 0.4 } = opts;
  const storageKey = `${STORAGE_PREFIX}${key}`;

  const [size, setSizeRaw] = useState(defaultSize);
  const [collapsed, setCollapsedRaw] = useState(defaultCollapsed);
  const [dragging, setDragging] = useState(false);
  const hydrated = useRef(false);

  // The live max also respects the viewport, so a saved 520px chat rail can't
  // swallow a small laptop screen.
  const liveMax = useCallback(() => {
    if (typeof window === "undefined") return max;
    const viewport = side === "bottom" ? window.innerHeight : window.innerWidth;
    return Math.max(min, Math.min(max, Math.round(viewport * viewportFraction)));
  }, [max, min, side, viewportFraction]);

  const setSize = useCallback(
    (px: number) => setSizeRaw(clamp(Math.round(px), min, liveMax())),
    [min, liveMax],
  );

  // Hydrate from localStorage after mount (not in the initializer) so SSR and the
  // first client render agree; the restored size lands one frame later.
  /* eslint-disable react-hooks/set-state-in-effect --
     One-time hydration from an external store (localStorage). Running it post-mount is
     deliberate: initializing state from localStorage would make SSR and client markup
     disagree. It flips two values exactly once — no cascading-render risk. */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as { size?: number; collapsed?: boolean };
        if (typeof saved.size === "number") setSizeRaw(clamp(Math.round(saved.size), min, liveMax()));
        if (typeof saved.collapsed === "boolean") setCollapsedRaw(saved.collapsed);
      }
    } catch {
      /* ignore bad saves */
    }
    hydrated.current = true;
    // hydrate once per panel key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ size, collapsed }));
    } catch {
      /* ignore quota */
    }
  }, [size, collapsed, storageKey]);

  const dragStart = useRef<{ pos: number; size: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* stale pointer id — drag still works via the move/up handlers */
      }
      dragStart.current = { pos: side === "bottom" ? e.clientY : e.clientX, size };
      setDragging(true);
      document.body.style.cursor = side === "bottom" ? "row-resize" : "col-resize";
      document.body.style.userSelect = "none";
    },
    [side, size],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const start = dragStart.current;
      if (!start) return;
      const pos = side === "bottom" ? e.clientY : e.clientX;
      // Growing direction depends on which edge the panel hugs.
      const delta = side === "left" ? pos - start.pos : start.pos - pos;
      setSize(start.size + delta);
    },
    [side, setSize],
  );

  const endDrag = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!dragStart.current) return;
    dragStart.current = null;
    setDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  }, []);

  const reset = useCallback(() => {
    setSizeRaw(defaultSize);
    setCollapsedRaw(false);
  }, [defaultSize]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      const grow = side === "bottom" ? "ArrowUp" : side === "left" ? "ArrowRight" : "ArrowLeft";
      const shrink = side === "bottom" ? "ArrowDown" : side === "left" ? "ArrowLeft" : "ArrowRight";
      if (e.key === grow) {
        e.preventDefault();
        setSize(size + 16);
      } else if (e.key === shrink) {
        e.preventDefault();
        setSize(size - 16);
      } else if (e.key === "Home") {
        e.preventDefault();
        setSizeRaw(min);
      } else if (e.key === "End") {
        e.preventDefault();
        setSizeRaw(liveMax());
      } else if (e.key === "Enter") {
        e.preventDefault();
        reset();
      }
    },
    [side, size, setSize, min, liveMax, reset],
  );

  const setCollapsed = useCallback((v: boolean) => setCollapsedRaw(v), []);
  const toggle = useCallback(() => setCollapsedRaw((v) => !v), []);

  return {
    size,
    collapsed,
    dragging,
    setSize,
    setCollapsed,
    toggle,
    reset,
    handleProps: {
      role: "separator",
      tabIndex: 0,
      "aria-orientation": side === "bottom" ? "horizontal" : "vertical",
      "aria-valuenow": size,
      "aria-valuemin": min,
      "aria-valuemax": max,
      "aria-label": `Resize ${key} panel`,
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onDoubleClick: reset,
      onKeyDown,
    },
  };
}
