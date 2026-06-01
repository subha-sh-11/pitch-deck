import type { ReactNode } from "react";

interface SlideFrameProps {
  children: ReactNode;
  className?: string;
}

export function SlideFrame({ children, className = "" }: SlideFrameProps) {
  return (
    <div
      className={`relative h-full w-full overflow-hidden bg-[#0a0a0c] text-[#F5F1E8] ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
      {children}
    </div>
  );
}

export function SlideLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-accent-neon">
      {children}
    </span>
  );
}
