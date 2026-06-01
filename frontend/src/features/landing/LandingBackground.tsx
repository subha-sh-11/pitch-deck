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

    const onMove = (e: MouseEvent) => {
      const el = meshRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      target.current = {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      };
    };

    const onLeave = () => {
      target.current = { x: 0.5, y: 0.35 };
    };

    const tick = () => {
      const lerp = prefersReduced ? 1 : 0.09;
      current.current.x += (target.current.x - current.current.x) * lerp;
      current.current.y += (target.current.y - current.current.y) * lerp;

      if (spotlightRef.current) {
        const x = current.current.x * 100;
        const y = current.current.y * 100;
        spotlightRef.current.style.setProperty("--mx", `${x}%`);
        spotlightRef.current.style.setProperty("--my", `${y}%`);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      if (rafRef.current !== undefined) {
        cancelAnimationFrame(rafRef.current);
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
