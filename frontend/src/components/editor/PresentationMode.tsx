"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SlideRenderer } from "@/components/slides/SlideRenderer";
import type { DesignDirection } from "@/types/design";
import type { Slide } from "@/types/slide";
import { IconChevronLeft, IconChevronRight, IconClose } from "./EditorIcons";

interface PresentationModeProps {
  slides: Slide[];
  index: number;
  designDirection?: DesignDirection;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

export function PresentationMode({
  slides,
  index,
  designDirection,
  onIndexChange,
  onClose,
}: PresentationModeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slide = slides[index];

  // Enter native fullscreen on mount; exit cleanly when leaving.
  useEffect(() => {
    const el = containerRef.current;
    el?.requestFullscreen?.().catch(() => {});
    return () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  // If the user exits native fullscreen (Esc / browser UI), close the overlay too.
  useEffect(() => {
    function onFsChange() {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (!active) onClose();
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [onClose]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    } else {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    }
  }, []);

  // Auto-hide the floating controls after a moment of no mouse movement.
  const nudgeChrome = useCallback(() => {
    setChromeVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setChromeVisible(false), 2200);
  }, []);

  useEffect(() => {
    nudgeChrome();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [nudgeChrome]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // Esc in non-fullscreen still closes; in fullscreen the browser exits
        // first and the fullscreenchange handler closes us.
        if (!document.fullscreenElement) onClose();
        return;
      }
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        onIndexChange(Math.min(slides.length - 1, index + 1));
        nudgeChrome();
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onIndexChange(Math.max(0, index - 1));
        nudgeChrome();
      }
      if (e.key === "f" || e.key === "F") toggleFullscreen();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, slides.length, onClose, onIndexChange, nudgeChrome, toggleFullscreen]);

  if (!slide) return null;

  const chrome = chromeVisible ? "opacity-100" : "opacity-0";

  return (
    <div
      ref={containerRef}
      onMouseMove={nudgeChrome}
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black ${
        chromeVisible ? "cursor-default" : "cursor-none"
      }`}
    >
      {/* Slide fills the screen at 16:9, letterboxed to fit — just like PPT. */}
      <div
        className="aspect-video max-h-full max-w-full shrink-0"
        style={{ width: "min(100vw, calc(100vh * 16 / 9))" }}
      >
        <SlideRenderer slide={slide} designDirection={designDirection} />
      </div>

      {/* Counter */}
      <div
        className={`pointer-events-none absolute left-5 top-4 rounded-full bg-black/40 px-3 py-1 text-sm tabular-nums text-white/70 backdrop-blur transition-opacity duration-300 ${chrome}`}
      >
        {index + 1} / {slides.length}
      </div>

      {/* Fullscreen toggle + close */}
      <div
        className={`absolute right-4 top-4 flex items-center gap-1 transition-opacity duration-300 ${chrome}`}
      >
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          className="rounded-lg p-2 text-white/80 hover:bg-white/10"
        >
          <IconFullscreen expanded={isFullscreen} />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Exit presentation"
          className="rounded-lg p-2 text-white/80 hover:bg-white/10"
        >
          <IconClose />
        </button>
      </div>

      {/* Prev / Next */}
      <button
        type="button"
        disabled={index === 0}
        onClick={() => onIndexChange(index - 1)}
        aria-label="Previous slide"
        className={`absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-3 text-white/80 backdrop-blur transition-opacity duration-300 hover:bg-white/10 disabled:opacity-0 ${chrome}`}
      >
        <IconChevronLeft className="h-7 w-7" />
      </button>
      <button
        type="button"
        disabled={index >= slides.length - 1}
        onClick={() => onIndexChange(index + 1)}
        aria-label="Next slide"
        className={`absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-3 text-white/80 backdrop-blur transition-opacity duration-300 hover:bg-white/10 disabled:opacity-0 ${chrome}`}
      >
        <IconChevronRight className="h-7 w-7" />
      </button>

      {/* Speaker notes (only when present) */}
      {slide.speakerNotes && (
        <div
          className={`absolute inset-x-0 bottom-0 border-t border-white/10 bg-black/70 px-6 py-3 backdrop-blur transition-opacity duration-300 ${chrome}`}
        >
          <p className="text-xs uppercase tracking-wider text-white/40">Speaker notes</p>
          <p className="mt-1 line-clamp-2 text-sm text-white/80">{slide.speakerNotes}</p>
        </div>
      )}
    </div>
  );
}

function IconFullscreen({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {expanded ? (
        <>
          <path d="M8 3v3a2 2 0 0 1-2 2H3" />
          <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
          <path d="M3 16h3a2 2 0 0 1 2 2v3" />
          <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
        </>
      ) : (
        <>
          <path d="M3 8V5a2 2 0 0 1 2-2h3" />
          <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
          <path d="M3 16v3a2 2 0 0 0 2 2h3" />
          <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
        </>
      )}
    </svg>
  );
}
