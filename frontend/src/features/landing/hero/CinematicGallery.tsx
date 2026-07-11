"use client";

import { useEffect, useRef } from "react";
import { CINEMATIC_CARDS } from "./data";
import { CinematicCard } from "./CinematicCard";

/**
 * Repeat the 5-card sequence this many times per group so one group is wider
 * than the largest target viewport (5 × ~260px × 2 ≈ 2600px > 1920px) — that
 * guarantees no blank gap ever appears during the loop.
 */
const REPEATS = 2;

/**
 * One marquee group = the curated sequence repeated `REPEATS` times.
 * The track holds two identical groups; only the very first pass of the first
 * group carries real alt text — everything else is a decorative duplicate.
 */
function MarqueeGroup({ duplicate }: { duplicate: boolean }) {
  return (
    <div className="hero-marquee-group" aria-hidden={duplicate || undefined}>
      {Array.from({ length: REPEATS }).flatMap((_, pass) =>
        CINEMATIC_CARDS.map((card, i) => {
          const primary = !duplicate && pass === 0;
          return (
            <CinematicCard
              key={`${card.id}-${pass}-${i}`}
              card={card}
              decorative={!primary}
              priority={primary && i < 3}
            />
          );
        }),
      )}
    </div>
  );
}

/**
 * Seamless left-to-right marquee of cinematic pitch-deck examples.
 * Motion is pure CSS transform on `.hero-marquee-track`; no JS/state.
 */
export function CinematicGallery() {
  const trackRef = useRef<HTMLDivElement>(null);

  // Pause the infinite marquee whenever it isn't on screen. Once you scroll
  // past the hero the animation stops, so it no longer keeps a large image
  // layer compositing and stealing frames from the sections below.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        track.style.animationPlayState = entry.isIntersecting ? "running" : "paused";
      },
      { rootMargin: "200px 0px" },
    );
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="hero-gallery-wrap">
      <div
        className="hero-marquee"
        role="region"
        aria-label="Cinematic pitch-deck examples"
      >
        <div className="hero-marquee-track" ref={trackRef}>
          <MarqueeGroup duplicate={false} />
          <MarqueeGroup duplicate />
        </div>
      </div>
      <div className="hero-gallery-fade" aria-hidden />
    </div>
  );
}
