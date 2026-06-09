"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { SlideTextBox } from "@/types/slide";
import { pxDeltaToPct, useSlideEdit } from "./SlideEditContext";

const DRAG_THRESHOLD = 4;

export function FreeTextLayer() {
  const { textBoxes, editing } = useSlideEdit();
  if (textBoxes.length === 0) return null;
  return (
    <>
      {textBoxes.map((box) => (
        <FreeTextBox key={box.id} box={box} editing={editing} />
      ))}
    </>
  );
}

function FreeTextBox({ box, editing }: { box: SlideTextBox; editing: boolean }) {
  const { updateTextBox, removeTextBox, selectedId, selectTextBox } = useSlideEdit();
  const selected = selectedId === box.id;
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  // Live position during a drag (committed once on release).
  const [live, setLive] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{
    x: number;
    y: number;
    baseX: number;
    baseY: number;
    lastX: number;
    lastY: number;
    moved: boolean;
  } | null>(null);

  useLayoutEffect(() => {
    if (active && ref.current) {
      ref.current.textContent = box.text;
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

  const xEff = box.xPct + (live?.x ?? 0);
  const yEff = box.yPct + (live?.y ?? 0);
  const baseStyle = {
    position: "absolute" as const,
    left: `${xEff}cqw`,
    top: `${yEff}cqh`,
    width: `${box.wPct}cqw`,
    fontSize: `${box.fontSize}cqw`,
    color: box.color ?? "#F5F1E8",
    textAlign: box.align ?? ("left" as const),
    fontWeight: box.bold ? 700 : 400,
    fontStyle: box.italic ? "italic" : "normal",
    lineHeight: 1.25,
    whiteSpace: "pre-wrap" as const,
    zIndex: 30,
  };

  if (!editing) {
    return (
      <div style={baseStyle} className="font-display">
        {box.text}
      </div>
    );
  }

  if (active) {
    const commit = () => {
      const text = ref.current?.innerText ?? "";
      setActive(false);
      updateTextBox(box.id, { text });
    };
    const onKeyDown = (e: ReactKeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        ref.current?.blur();
      }
    };
    return (
      <div
        ref={ref}
        data-slide-text
        style={{ ...baseStyle, cursor: "text", outline: "1px solid rgba(34,211,238,0.6)" }}
        className="font-display"
        contentEditable
        suppressContentEditableWarning
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
    );
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      baseX: box.xPct,
      baseY: box.yPct,
      lastX: 0,
      lastY: 0,
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
    d.lastX = dxPct;
    d.lastY = dyPct;
    setLive({ x: dxPct, y: dyPct });
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    const d = drag.current;
    drag.current = null;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (!d) return;
    if (d.moved) {
      setLive(null);
      updateTextBox(box.id, {
        xPct: Math.max(0, Math.min(98, d.baseX + d.lastX)),
        yPct: Math.max(0, Math.min(98, d.baseY + d.lastY)),
      });
    } else {
      selectTextBox(box.id); // single click selects (toolbar appears); double-click edits
    }
  };

  const bump = (delta: number) =>
    updateTextBox(box.id, { fontSize: Math.max(1, Math.min(12, box.fontSize + delta)) });

  return (
    <div
      ref={ref}
      data-slide-text
      style={{
        ...baseStyle,
        cursor: "move",
        outline: selected ? "1px solid rgba(34,211,238,0.8)" : "1px dashed rgba(255,255,255,0.35)",
      }}
      className="font-display"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={() => setActive(true)}
      title="Click to select · double-click to edit · drag to move"
    >
      {box.text}
      {/* Persistent mini toolbar while this box is selected */}
      {selected && (
        <div
          data-slide-toolbar
          className={`absolute left-0 z-40 flex items-center gap-1.5 rounded-md bg-black/85 px-2 py-1 text-white shadow-lg ${
            box.yPct < 8 ? "top-full mt-1" : "-top-8"
          }`}
          style={{ fontSize: "12px" }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button type="button" className="px-1 leading-none hover:text-[#22d3ee]" onClick={() => bump(-0.5)} title="Smaller">
            A−
          </button>
          <button type="button" className="px-1 text-base leading-none hover:text-[#22d3ee]" onClick={() => bump(0.5)} title="Larger">
            A+
          </button>
          <button
            type="button"
            className="px-1 leading-none hover:text-[#22d3ee]"
            onClick={() => setActive(true)}
            title="Edit text"
          >
            ✎
          </button>
          <input
            type="color"
            value={box.color ?? "#F5F1E8"}
            onChange={(e) => updateTextBox(box.id, { color: e.target.value })}
            className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
            title="Color"
          />
          <button
            type="button"
            className="px-1 leading-none hover:text-red-400"
            onClick={() => removeTextBox(box.id)}
            title="Delete"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
