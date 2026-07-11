"use client";

import { useEffect, useRef } from "react";

export function LandingBackground() {
  const meshRef = useRef<HTMLDivElement>(null);
  const spotlightRef = useRef<HTMLDivElement>(null);
  const target = useRef({ x: 0.5, y: 0.35 });
  const current = useRef({ x: 0.5, y: 0.35 });
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const paint = (x: number, y: number) => {
      spotlightRef.current?.style.setProperty("--mx", `${x * 100}%`);
      spotlightRef.current?.style.setProperty("--my", `${y * 100}%`);
    };

    // Reduced motion (or no animation wanted): render once, run no loop.
    if (prefersReduced) {
      paint(target.current.x, target.current.y);
      return;
    }

    // The RAF loop only runs while the spotlight is easing toward the cursor.
    // Once it settles it stops entirely, so scrolling with a still mouse costs
    // zero per-frame repaints of this full-viewport gradient.
    const tick = () => {
      const dx = target.current.x - current.current.x;
      const dy = target.current.y - current.current.y;
      current.current.x += dx * 0.09;
      current.current.y += dy * 0.09;
      paint(current.current.x, current.current.y);

      if (Math.abs(dx) > 0.0005 || Math.abs(dy) > 0.0005) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = undefined; // settled — let the loop die
      }
    };

    const startLoop = () => {
      if (rafRef.current === undefined) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    const onMove = (e: MouseEvent) => {
      const el = meshRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      target.current = {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      };
      startLoop();
    };

    const onLeave = () => {
      target.current = { x: 0.5, y: 0.35 };
      startLoop();
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);

    return () => {
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      if (rafRef.current !== undefined) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = undefined;
      }
    };
  }, []);

  return (
    <div ref={meshRef} className="landing-mesh" aria-hidden>
      <div ref={spotlightRef} className="landing-cursor-spotlight" />
      <div className="landing-grid" />
      <div className="landing-noise" />
    </div>
  );
}
