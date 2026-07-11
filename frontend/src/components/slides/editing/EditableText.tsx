"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ElementType,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { pxDeltaToPct, useSlideEdit } from "./SlideEditContext";

interface EditableTextProps {
  /** Stable key identifying this element within the slide (e.g. "heading", "item-0-title"). */
  k: string;
  /** Original text from the template's content. */
  value: string;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  /** Allow Enter to insert newlines instead of committing. */
  multiline?: boolean;
}

const DRAG_THRESHOLD = 4;

export function EditableText({
  k,
  value,
  as: Tag = "div",
  className = "",
  style,
  multiline = false,
}: EditableTextProps) {
  const { editing, edits, setEdit, selectEl, selectedEl } = useSlideEdit();
  const edit = edits[k] ?? {};
  const resolved = edit.text ?? value ?? "";


  const selected = editing && selectedEl?.k === k;

  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);
  // The element's UNSCALED font size (px) from its own Tailwind class. fontScale multiplies THIS,
  // not `1em` (which is parent-relative and collapsed every element to the same size — so only
  // headings appeared to change). Captured once, before any scale is applied.
  const [baseFont, setBaseFont] = useState<number | null>(null);
  // Live font scale / width during a drag-resize (committed once on release, so it doesn't flood
  // the undo stack). null → use the stored edit value.
  const [liveScale, setLiveScale] = useState<number | null>(null);
  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  // The selected element's box, in coordinates RELATIVE TO THE SLIDE ROOT. The slide frame uses
  // `container-type: size`, which makes `position: fixed` resolve against the slide (not the
  // viewport) — so the handles must be positioned in slide-root space, not viewport space.
  const [handleRect, setHandleRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  // dir: "e" (width), "s" (font/height), "se" (both).
  const rz = useRef<{ dir: string; x: number; y: number; baseScale: number; baseWidth: number; rootW: number } | null>(null);
  // Live drag offset (delta from the committed position) — kept local so dragging
  // doesn't write to state/backend on every pointer move; we commit once on release.
  const [live, setLive] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{
    x: number;
    y: number;
    baseDx: number;
    baseDy: number;
    lastDx: number;
    lastDy: number;
    moved: boolean;
  } | null>(null);

  // When entering text-edit, seed the DOM with the current text and place the caret.
  useLayoutEffect(() => {
    if (active && ref.current) {
      ref.current.textContent = resolved;
      ref.current.focus();
      const range = document.createRange();
      range.selectNodeContents(ref.current);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Capture the element's own base font size once (before any scale is applied), so fontScale
  // multiplies the element's REAL size rather than the parent's.
  useLayoutEffect(() => {
    if (baseFont == null && ref.current) {
      const px = parseFloat(getComputedStyle(ref.current).fontSize);
      if (px) setBaseFont(px);
    }
  }, [baseFont]);

  // Keep the drag-resize handles pinned to the selected element's box. We measure the element's
  // VIEWPORT rect (getBoundingClientRect) and render the handle overlay via a PORTAL to <body> in
  // fixed/viewport coordinates. This sidesteps the containing-block trap entirely: the slide-root's
  // `container-type: size` (and any template ancestor with transform/backdrop-filter) would
  // otherwise capture our `position: fixed` overlay and resolve its coordinates against an
  // unpredictable, possibly SCALED box — which is why the handles drifted off the text.
  const measure = useCallback(() => {
    const el = ref.current;
    if (selected && el) {
      const er = el.getBoundingClientRect();
      setHandleRect({ left: er.left, top: er.top, width: er.width, height: er.height });
    } else {
      setHandleRect(null);
    }
  }, [selected]);

  useLayoutEffect(() => {
    measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, edit.fontScale, liveScale, edit.widthPct, liveWidth, edit.dxPct, edit.dyPct, edit.color, edit.scrim, resolved, active]);

  // The overlay is fixed to the viewport, so keep it glued to the element as the page scrolls or
  // resizes (the workshop is a scrollable list of slide cards).
  useEffect(() => {
    if (!selected) return;
    const onMove = () => measure();
    window.addEventListener("scroll", onMove, true); // capture → catch scroll on any ancestor
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [selected, measure]);

  if (edit.hidden) return null;

  // ── Directional mouse resize ──
  //   • right edge (e)   → drag horizontally to widen/narrow (text rewraps)
  //   • bottom edge (s)  → drag vertically to grow/shrink the font (taller/shorter)
  //   • corner (se)      → both at once
  const onRzDown = (dir: string) => (e: ReactPointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    // Use LIVE (visible/scaled) rects for both the root width and the element's current width, so
    // the starting width % and the drag-delta math share the same (screen-pixel) coordinate space.
    const el = ref.current;
    const root = el?.closest("[data-slide-root]") as HTMLElement | null;
    const rr = root?.getBoundingClientRect();
    const er = el?.getBoundingClientRect();
    const rootW = rr?.width || 0;
    const curW = er && rootW ? (er.width / rootW) * 100 : 40;
    rz.current = {
      dir, x: e.clientX, y: e.clientY,
      baseScale: edit.fontScale ?? 1,
      baseWidth: edit.widthPct ?? curW,
      rootW,
    };
    if (dir.includes("s")) setLiveScale(edit.fontScale ?? 1);
    if (dir.includes("e")) setLiveWidth(edit.widthPct ?? curW);
  };
  const onRzMove = (e: ReactPointerEvent) => {
    const r = rz.current;
    if (!r) return;
    if (r.dir.includes("e") && r.rootW) {
      const w = r.baseWidth + ((e.clientX - r.x) / r.rootW) * 100;
      setLiveWidth(Math.max(12, Math.min(100, +w.toFixed(1))));
    }
    if (r.dir.includes("s")) {
      const sc = r.baseScale + (e.clientY - r.y) / 160; // drag down = bigger
      setLiveScale(Math.max(0.4, Math.min(4, +sc.toFixed(2))));
    }
  };
  const onRzUp = (e: ReactPointerEvent) => {
    const r = rz.current;
    rz.current = null;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (r) {
      const patch: { fontScale?: number; widthPct?: number } = {};
      if (r.dir.includes("s") && liveScale != null) patch.fontScale = liveScale;
      if (r.dir.includes("e") && liveWidth != null) patch.widthPct = liveWidth;
      if (Object.keys(patch).length) setEdit(k, patch);
    }
    setLiveScale(null);
    setLiveWidth(null);
  };

  // Resize handles on the selected element's right edge, bottom edge, and corner. Rendered through
  // a PORTAL to <body> in viewport (fixed) coordinates so no ancestor containing-block can offset
  // or scale them — they land exactly on the element's on-screen box.
  const HANDLE = "absolute rounded-sm border border-white/70 bg-accent-neon shadow";
  const resizeHandle =
    selected && handleRect && typeof document !== "undefined"
      ? createPortal(
          <div data-slide-toolbar style={{ position: "fixed", left: handleRect.left, top: handleRect.top,
                 width: handleRect.width, height: handleRect.height, zIndex: 1000, pointerEvents: "none" }}>
            {/* right edge — horizontal resize */}
            <div onPointerDown={onRzDown("e")} onPointerMove={onRzMove} onPointerUp={onRzUp}
              title="Drag to widen (text rewraps)"
              className={HANDLE}
              style={{ pointerEvents: "auto", right: -5, top: "50%", transform: "translateY(-50%)", width: 10, height: 22, cursor: "ew-resize" }} />
            {/* bottom edge — vertical resize (font size) */}
            <div onPointerDown={onRzDown("s")} onPointerMove={onRzMove} onPointerUp={onRzUp}
              title="Drag to grow taller"
              className={HANDLE}
              style={{ pointerEvents: "auto", bottom: -5, left: "50%", transform: "translateX(-50%)", width: 22, height: 10, cursor: "ns-resize" }} />
            {/* corner — both */}
            <div onPointerDown={onRzDown("se")} onPointerMove={onRzMove} onPointerUp={onRzUp}
              title="Drag to resize"
              className={HANDLE}
              style={{ pointerEvents: "auto", right: -5, bottom: -5, width: 12, height: 12, cursor: "se-resize" }} />
          </div>,
          document.body,
        )
      : null;

  const dx = edit.dxPct ?? 0;
  const dy = edit.dyPct ?? 0;
  const dxEff = dx + (live?.x ?? 0);
  const dyEff = dy + (live?.y ?? 0);
  const mergedStyle: CSSProperties = {
    ...style,
    // `transform` (used for drag-move) is IGNORED on inline elements, so headings/labels rendered
    // as <span> couldn't be moved. Make span-based editable text inline-block so the move applies.
    ...(Tag === "span" ? { display: "inline-block" } : {}),
    ...(dxEff || dyEff ? { transform: `translate(${dxEff}cqw, ${dyEff}cqh)` } : {}),
    // Force the colour to win even over gradient/clipped text (which uses -webkit-text-fill-color
    // and would otherwise ignore `color`). backgroundImage:none drops any text gradient too.
    ...(edit.color
      ? { color: edit.color, WebkitTextFillColor: edit.color, backgroundImage: "none" }
      : {}),
    // Apply the scale off the captured base size (live drag-resize wins). Until base is measured
    // we leave font-size to the class (so the first paint is correct and we can read the true base).
    ...((liveScale ?? edit.fontScale) && baseFont
      ? { fontSize: `${(baseFont * (liveScale ?? edit.fontScale ?? 1)).toFixed(2)}px` }
      : {}),
    // Width from the right-edge handle → text rewraps to this width (% of the slide).
    ...((liveWidth ?? edit.widthPct)
      ? { maxWidth: `${liveWidth ?? edit.widthPct}cqw`, width: `${liveWidth ?? edit.widthPct}cqw` }
      : {}),
    // Frosted panel behind the text so it stays readable over a busy image.
    ...(edit.scrim
      ? {
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          backgroundColor: "rgba(0,0,0,0.34)",
          padding: "0.12em 0.4em",
          borderRadius: "6px",
          boxDecorationBreak: "clone",
          WebkitBoxDecorationBreak: "clone",
        }
      : {}),
  };

  // Read-only render (thumbnails, presentation, or non-editing canvas).
  if (!editing) {
    return (
      <Tag className={className} style={mergedStyle}>
        {resolved}
      </Tag>
    );
  }

  // ── Text-edit mode ── (element stays SELECTED so the top toolbar persists)
  if (active) {
    const commit = () => {
      const text = ref.current?.innerText ?? "";
      setActive(false);
      if (text !== resolved) {
        setEdit(k, { text });
        selectEl({ k, text }); // keep the toolbar targeting this element with fresh text
      }
    };
    const onKeyDown = (e: ReactKeyboardEvent) => {
      if (e.key === "Escape" || (e.key === "Enter" && !multiline)) {
        e.preventDefault();
        ref.current?.blur();
      }
    };
    return (
      <>
        <Tag
          ref={ref}
          data-slide-text
          className={`${className} pde-editing`}
          style={{ ...mergedStyle, cursor: "text" }}
          contentEditable
          suppressContentEditableWarning
          onBlur={commit}
          onKeyDown={onKeyDown}
        />
        {resizeHandle}
      </>
    );
  }

  // ── Idle editing mode: click to edit, drag to move ──
  const onPointerDown = (e: ReactPointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      baseDx: dx,
      baseDy: dy,
      lastDx: 0,
      lastDy: 0,
      moved: false,
    };
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const ddx = e.clientX - d.x;
    const ddy = e.clientY - d.y;
    if (!d.moved && Math.hypot(ddx, ddy) < DRAG_THRESHOLD) return;
    d.moved = true;
    const { dxPct, dyPct } = pxDeltaToPct(ref.current, ddx, ddy);
    d.lastDx = dxPct;
    d.lastDy = dyPct;
    setLive({ x: dxPct, y: dyPct }); // local visual only
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    const d = drag.current;
    drag.current = null;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (!d) return;
    if (d.moved) {
      setLive(null);
      setEdit(k, { dxPct: d.baseDx + d.lastDx, dyPct: d.baseDy + d.lastDy }); // commit once
    } else {
      // A click (no drag): select this element (shows the persistent top toolbar) AND edit it.
      selectEl({ k, text: resolved });
      setActive(true);
    }
  };

  return (
    <>
      <Tag
        ref={ref}
        data-slide-text
        className={`${className} pde-editable`}
        style={{
          ...mergedStyle,
          cursor: "move",
          ...(selected ? { outline: "1px dashed rgba(34,211,238,0.7)", outlineOffset: "2px" } : {}),
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        title="Click to edit / select · drag to move · drag the corner handle to resize"
      >
        {resolved}
      </Tag>
      {resizeHandle}
    </>
  );
}
