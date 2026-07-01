"use client";

import { useEffect, useState } from "react";

/**
 * A displayed progress value that smoothly creeps toward ~92% while `active`, so a coarse or
 * blocking backend job never shows a frozen "0%". Any REAL progress that arrives still wins (the
 * returned value is the max of the simulated creep and the real value). When `active` turns false
 * the creep resets — by then the overlay using it is typically gone.
 */
export function useSmoothProgress(realProgress: number, active: boolean): number {
  const [smooth, setSmooth] = useState(0);

  useEffect(() => {
    if (!active) {
      setSmooth(0);
      return;
    }
    // Jump off zero immediately so it never reads 0%.
    setSmooth((s) => Math.max(s, 6));
    const id = setInterval(() => {
      // Ease toward ~92%, slowing as it climbs (it never "finishes" on its own — completion is
      // when the job ends and the overlay is replaced).
      setSmooth((s) => Math.min(92, s + Math.max(0.5, (92 - s) * 0.07)));
    }, 350);
    return () => clearInterval(id);
  }, [active]);

  return Math.round(Math.max(smooth, realProgress || 0));
}
