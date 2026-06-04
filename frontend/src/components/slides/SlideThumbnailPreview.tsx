"use client";

import { useEffect, useRef, useState } from "react";
import { SlideRenderer } from "./SlideRenderer";
import type { DesignDirection } from "@/types/design";
import type { Slide } from "@/types/slide";

interface SlideThumbnailPreviewProps {
  slide: Slide;
  active?: boolean;
  designDirection?: DesignDirection;
}

// The thumbnail renders the REAL slide at a fixed 16:9 canvas, then scales the
// whole thing down to fit its container — so every thumbnail mirrors exactly what
// is on the slide (image, copy, theme), instead of a generic placeholder.
const BASE_WIDTH = 1280;
const BASE_HEIGHT = (BASE_WIDTH * 9) / 16;

export function SlideThumbnailPreview({
  slide,
  active,
  designDirection,
}: SlideThumbnailPreviewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.12);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / BASE_WIDTH);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`relative aspect-video w-full overflow-hidden rounded-md bg-[#0c0c0e] ${
        active ? "ring-1 ring-[#22d3ee]/40" : ""
      }`}
    >
      <div
        className="pointer-events-none absolute left-0 top-0 origin-top-left"
        style={{
          width: BASE_WIDTH,
          height: BASE_HEIGHT,
          transform: `scale(${scale})`,
        }}
      >
        <SlideRenderer slide={slide} designDirection={designDirection} />
      </div>
      {active && (
        <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(34,211,238,0.15)]" />
      )}
    </div>
  );
}
