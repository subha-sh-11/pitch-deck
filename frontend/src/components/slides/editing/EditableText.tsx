"use client";

import {
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ElementType,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useState,
} from "react";
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
  // Live font scale during a corner-drag resize (committed once on release, so it doesn't flood
  // the undo stack). null → use the stored edit.fontScale.
  const [liveScale, setLiveScale] = useState<number | null>(null);
  // Bounding rect of the selected element, so the drag-resize handle can sit at its corner.
  const [handleRect, setHandleRect] = useState<DOMRect | null>(null);
  const rz = useRef<{ x: number; y: number; base: number } | null>(null);
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

  // Keep the drag-resize handle pinned to the selected element's bottom-right corner (follows it
  // as the text grows/shrinks/moves).
  useLayoutEffect(() => {
    setHandleRect(selected && ref.current ? ref.current.getBoundingClientRect() : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, edit.fontScale, liveScale, edit.dxPct, edit.dyPct, edit.color, edit.scrim, resolved, active]);

  if (edit.hidden) return null;

  // ── Mouse resize: drag the corner handle to scale the font (diagonal drag = grow/shrink) ──
  const onRzDown = (e: ReactPointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    rz.current = { x: e.clientX, y: e.clientY, base: edit.fontScale ?? 1 };
    setLiveScale(edit.fontScale ?? 1);
  };
  const onRzMove = (e: ReactPointerEvent) => {
    const r = rz.current;
    if (!r) return;
    const delta = (e.clientX - r.x + (e.clientY - r.y)) / 2; // px, down-right = bigger
    setLiveScale(Math.max(0.4, Math.min(4, +(r.base + delta / 160).toFixed(2))));
  };
  const onRzUp = (e: ReactPointerEvent) => {
    const r = rz.current;
    rz.current = null;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (r && liveScale != null) setEdit(k, { fontScale: liveScale });
    setLiveScale(null);
  };

  // Fixed-position handle at the selected element's bottom-right corner (a sibling, never a child
  // of the contentEditable Tag). Shown whenever this element is selected.
  const resizeHandle =
    selected && handleRect ? (
      <div
        data-slide-toolbar
        title="Drag to resize the text"
        onPointerDown={onRzDown}
        onPointerMove={onRzMove}
        onPointerUp={onRzUp}
        style={{
          position: "fixed",
          left: handleRect.right - 6,
          top: handleRect.bottom - 6,
          width: 14,
          height: 14,
          zIndex: 50,
          cursor: "se-resize",
        }}
        className="rounded-sm border border-white/70 bg-accent-neon shadow"
      />
    ) : null;

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
