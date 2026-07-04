"use client";

import { useEffect } from "react";

/**
 * Water-like inertial wheel scrolling for the landing page.
 *
 * Eases the window toward a target scroll position instead of jumping, giving a
 * smooth glide on mouse-wheel input. Intentionally conservative:
 *  - disabled for touch / coarse pointers (native momentum is already good there)
 *  - disabled under prefers-reduced-motion
 *  - leaves pinch-zoom, horizontal, and modifier scrolls untouched
 *  - uses `behavior: "instant"` so it never fights CSS smooth anchor scrolling
 */
export function SmoothScroll() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (media.matches || coarse) return;

    let target = window.scrollY;
    let raf: number | null = null;
    let animating = false;

    const maxScroll = () =>
      Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

    const tick = () => {
      const current = window.scrollY;
      const next = current + (target - current) * 0.12;
      if (Math.abs(target - current) < 0.5) {
        window.scrollTo({ top: target, behavior: "instant" as ScrollBehavior });
        animating = false;
        raf = null;
        return;
      }
      window.scrollTo({ top: next, behavior: "instant" as ScrollBehavior });
      raf = requestAnimationFrame(tick);
    };

    const onWheel = (e: WheelEvent) => {
      // Let zoom, horizontal intent, and modifier scrolls behave natively.
      if (e.ctrlKey || e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      const step = e.deltaMode === 1 ? 22 : e.deltaMode === 2 ? window.innerHeight : 1;
      target = Math.min(maxScroll(), Math.max(0, target + e.deltaY * step));
      if (!animating) {
        animating = true;
        raf = requestAnimationFrame(tick);
      }
    };

    // Keep the target in sync when the user scrolls by other means
    // (keyboard, scrollbar drag, anchor navigation).
    const onScroll = () => {
      if (!animating) target = window.scrollY;
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onScroll);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
