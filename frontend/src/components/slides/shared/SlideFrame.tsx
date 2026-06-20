"use client";

import type {
  CSSProperties,
  ReactNode,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { FreeTextLayer } from "../editing/FreeTextLayer";
import { ImageReplaceControl } from "../editing/ImageReplaceControl";
import { clientPointToPct, useSlideEdit } from "../editing/SlideEditContext";

interface SlideFrameProps {
  children: ReactNode;
  className?: string;
  /** Generated image rendered full-bleed as the slide's base layer. */
  imageUrl?: string;
}

export function SlideFrame({ children, className = "", imageUrl }: SlideFrameProps) {
  const { editing, imageUrl: editedImageUrl, addTextBox, selectTextBox } = useSlideEdit();
  // The provider holds the live (possibly user-replaced) image URL.
  const resolvedImage = editedImageUrl ?? imageUrl;

  function onDoubleClick(e: ReactMouseEvent<HTMLDivElement>) {
    if (!editing) return;
    if ((e.target as HTMLElement).closest("[data-slide-text]")) return; // editing existing text
    const { xPct, yPct } = clientPointToPct(e.currentTarget, e.clientX, e.clientY);
    addTextBox(xPct, yPct);
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!editing) return;
    const t = e.target as HTMLElement;
    // Clicking empty slide area deselects any selected text box.
    if (t.closest("[data-slide-text]") || t.closest("[data-slide-toolbar]")) return;
    selectTextBox(null);
  }

  return (
    <div
      data-slide-root
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
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
        />
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
