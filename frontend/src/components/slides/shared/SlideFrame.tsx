"use client";

import type {
  CSSProperties,
  ReactNode,
  PointerEvent as ReactPointerEvent,
} from "react";
import { ElementToolbar } from "../editing/ElementToolbar";
import { FreeTextLayer } from "../editing/FreeTextLayer";
import { ImageReplaceControl } from "../editing/ImageReplaceControl";
import { useSlideEdit } from "../editing/SlideEditContext";

interface SlideFrameProps {
  children: ReactNode;
  className?: string;
  /** Generated image rendered full-bleed as the slide's base layer. */
  imageUrl?: string;
}

export function SlideFrame({ children, className = "", imageUrl }: SlideFrameProps) {
  const { editing, imageUrl: editedImageUrl, imageEffects, addTextBox, selectTextBox, selectEl } =
    useSlideEdit();
  // The provider holds the live (possibly user-replaced) image URL.
  const resolvedImage = editedImageUrl ?? imageUrl;
  // Non-destructive background adjustments set via chat ("blur the image", "darken it", "zoom").
  const blur = imageEffects?.blur ?? 0;
  const dim = imageEffects?.dim ?? 0;
  const scale = imageEffects?.scale ?? 1;

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!editing) return;
    const t = e.target as HTMLElement;
    // Clicking empty slide area deselects any selected text box / element.
    if (t.closest("[data-slide-text]") || t.closest("[data-slide-toolbar]")) return;
    selectTextBox(null);
    selectEl(null);
  }

  // Add a free text box in the slide's upper-left (deliberate button — NOT double-click, which
  // used to fire accidentally over the full-bleed image and spawn stray "New text" boxes).
  function addText() {
    addTextBox(10, 12);
  }

  return (
    <div
      data-slide-root
      onPointerDown={onPointerDown}
      className={`relative h-full w-full overflow-hidden ${className}`}
      // Background/text follow the deck palette (via CSS vars) and fall back to the dark
      // cinematic default — so changing the theme's base/text colour recolours every slide.
      style={
        {
          containerType: "size",
          background: "var(--slide-bg, #0a0a0c)",
          color: "var(--slide-text, #F5F1E8)",
        } as CSSProperties
      }
    >
      {resolvedImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolvedImage}
          alt=""
          className="absolute inset-0 z-0 h-full w-full object-cover"
          style={{
            filter: blur ? `blur(${blur}px)` : undefined,
            transform: scale && scale !== 1 ? `scale(${scale})` : undefined,
          }}
        />
      )}
      {resolvedImage && dim > 0 && (
        <div className="pointer-events-none absolute inset-0 z-0 bg-black" style={{ opacity: dim }} />
      )}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.035]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
      {children}
      <FreeTextLayer />
      <ImageReplaceControl />
      {/* Persistent top toolbar for the selected template element. */}
      <ElementToolbar />
      {/* Deliberate "add text" control (top-left) — replaces accidental double-click adds. */}
      {editing && (
        <button
          type="button"
          data-slide-toolbar
          onPointerDown={(e) => e.stopPropagation()}
          onClick={addText}
          title="Add a text box"
          className="absolute left-[3%] top-[3%] z-40 flex items-center gap-1 rounded-full bg-black/80 px-2.5 py-1 text-white shadow-lg ring-1 ring-white/10 hover:bg-black"
          style={{ fontSize: "min(2.2cqw, 12px)" }}
        >
          ＋ Text
        </button>
      )}
    </div>
  );
}

export function SlideLabel({ children }: { children: ReactNode }) {
  return (
    <span
      className="text-[10px] font-semibold uppercase tracking-[0.28em]"
      style={{ color: "var(--slide-accent, #22d3ee)" }}
    >
      {children}
    </span>
  );
}
