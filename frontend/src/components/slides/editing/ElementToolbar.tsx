"use client";

import { useSlideEdit } from "./SlideEditContext";

/**
 * Canva-style toolbar pinned to the TOP of the slide. It appears whenever a built-in template text
 * element is selected and stays put while you edit — so resize / colour / duplicate / delete are
 * always reachable and never vanish mid-edit. Rendered inside SlideFrame (within the edit provider)
 * and marked data-slide-toolbar so clicks on it don't deselect or start a drag.
 */
export function ElementToolbar() {
  const { editing, selectedEl, edits, setEdit, addTextBox, selectEl } = useSlideEdit();
  if (!editing || !selectedEl) return null;

  const k = selectedEl.k;
  const scale = edits[k]?.fontScale ?? 1;
  const bump = (delta: number) => setEdit(k, { fontScale: Math.max(0.4, Math.min(4, +(scale + delta).toFixed(2)) ) });

  return (
    <div
      data-slide-toolbar
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto absolute left-1/2 top-[3%] z-40 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/90 px-2 py-1 text-white shadow-xl ring-1 ring-white/10"
      style={{ fontSize: "min(2.2cqw, 13px)" }}
    >
      <button type="button" title="Smaller" onClick={() => bump(-0.1)}
        className="rounded px-1.5 leading-none hover:text-accent-neon">A−</button>
      <span className="min-w-[2.4em] text-center text-[0.8em] text-white/60">{Math.round(scale * 100)}%</span>
      <button type="button" title="Bigger" onClick={() => bump(0.1)}
        className="rounded px-1.5 text-[1.15em] leading-none hover:text-accent-neon">A+</button>

      <span className="mx-0.5 h-[1.2em] w-px bg-white/25" />

      <label title="Text colour" className="flex cursor-pointer items-center gap-1 px-1">
        <span className="text-[0.8em] text-white/60">Colour</span>
        <input type="color" value={edits[k]?.color ?? "#F5F1E8"}
          onChange={(e) => setEdit(k, { color: e.target.value })}
          className="h-[1.1em] w-[1.4em] cursor-pointer border-0 bg-transparent p-0" />
      </label>

      <span className="mx-0.5 h-[1.2em] w-px bg-white/25" />

      <button type="button" title="Blur the background behind this text (for legibility)"
        onClick={() => setEdit(k, { scrim: !edits[k]?.scrim })}
        className={`rounded px-1.5 leading-none hover:text-accent-neon ${edits[k]?.scrim ? "text-accent-neon" : ""}`}>
        ▨ <span className="text-[0.8em]">Blur bg</span>
      </button>

      <span className="mx-0.5 h-[1.2em] w-px bg-white/25" />

      <button type="button" title="Duplicate as a movable text box"
        onClick={() => addTextBox(12, 14, { text: selectedEl.text })}
        className="flex items-center gap-1 rounded px-1.5 leading-none hover:text-accent-neon">⧉ <span className="text-[0.8em]">Duplicate</span></button>
      <button type="button" title="Hide this element"
        onClick={() => { setEdit(k, { hidden: true }); selectEl(null); }}
        className="rounded px-1.5 leading-none hover:text-red-400">✕</button>

      <span className="mx-0.5 h-[1.2em] w-px bg-white/25" />
      <button type="button" title="Done" onClick={() => selectEl(null)}
        className="rounded px-1.5 leading-none text-accent-neon hover:text-accent-neon-dim">Done</button>
    </div>
  );
}
