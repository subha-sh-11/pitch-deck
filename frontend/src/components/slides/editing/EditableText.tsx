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
  const { editing, edits, setEdit } = useSlideEdit();
  const edit = edits[k] ?? {};
  const resolved = edit.text ?? value ?? "";

  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);
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

  if (edit.hidden) return null;

  const dx = edit.dxPct ?? 0;
  const dy = edit.dyPct ?? 0;
  const dxEff = dx + (live?.x ?? 0);
  const dyEff = dy + (live?.y ?? 0);
  const mergedStyle: CSSProperties = {
    ...style,
    ...(dxEff || dyEff ? { transform: `translate(${dxEff}cqw, ${dyEff}cqh)` } : {}),
    ...(edit.color ? { color: edit.color } : {}),
    ...(edit.fontScale ? { fontSize: `calc(1em * ${edit.fontScale})` } : {}),
  };

  // Read-only render (thumbnails, presentation, or non-editing canvas).
  if (!editing) {
    return (
      <Tag className={className} style={mergedStyle}>
        {resolved}
      </Tag>
    );
  }

  // ── Text-edit mode ──
  if (active) {
    const commit = () => {
      const text = ref.current?.innerText ?? "";
      setActive(false);
      if (text !== resolved) setEdit(k, { text });
    };
    const onKeyDown = (e: ReactKeyboardEvent) => {
      if (e.key === "Escape" || (e.key === "Enter" && !multiline)) {
        e.preventDefault();
        ref.current?.blur();
      }
    };
    return (
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
      setActive(true); // a click (no drag) → edit text
    }
  };

  return (
    <Tag
      ref={ref}
      data-slide-text
      className={`${className} pde-editable`}
      style={{ ...mergedStyle, cursor: "move" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      title="Click to edit · drag to move"
    >
      {resolved}
    </Tag>
  );
}
