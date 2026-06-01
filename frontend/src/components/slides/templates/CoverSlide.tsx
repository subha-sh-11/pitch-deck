import type { SlideContent } from "@/types/slide";
import { SlideFrame } from "../shared/SlideFrame";

interface CoverSlideProps {
  content: SlideContent;
}

export function CoverSlide({ content }: CoverSlideProps) {
  return (
    <SlideFrame>
      {/* Concrete texture base */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0c0c0e] via-[#141418] to-[#080808]" />

      {/* Spotlight from top-right */}
      <div className="absolute -right-20 -top-20 h-[70%] w-[60%] rounded-full bg-gradient-to-bl from-[#22d3ee]/12 via-[#A9C6C7]/8 to-transparent blur-3xl" />

      {/* Water reflection glow bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-2/5 bg-gradient-to-t from-[#3F5F4A]/25 via-[#A9C6C7]/10 to-transparent" />

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.65)_100%)]" />

      {/* Tank silhouette — right side */}
      <div className="absolute right-[6%] top-1/2 -translate-y-1/2">
        <div className="relative h-[72%] w-[28vw] max-w-[280px] min-w-[160px]">
          <div className="absolute inset-0 rounded-t-full rounded-b-lg bg-gradient-to-b from-[#2A2A2A] via-[#1a1a1f] to-[#3F5F4A]/40 shadow-[inset_0_0_60px_rgba(0,0,0,0.8)]" />
          <div className="absolute inset-x-[8%] top-[12%] h-[55%] rounded-t-full bg-gradient-to-b from-[#1a1a1f] to-[#0a0a0c]/80" />
          <div className="absolute -right-2 top-[18%] h-8 w-3 rounded-sm bg-[#8A4B2A]/80" />
          <div className="absolute bottom-[8%] left-[10%] right-[10%] h-1 bg-[#A9C6C7]/30 blur-sm" />
          <div className="absolute -inset-4 rounded-full bg-[#22d3ee]/5 blur-2xl" />
        </div>
      </div>

      {/* Neon accent line */}
      <div className="absolute bottom-[28%] left-[8%] h-px w-24 bg-gradient-to-r from-[#22d3ee] to-transparent" />

      {/* Content — bottom-left */}
      <div className="relative z-10 flex h-full flex-col justify-end p-[8%] pb-[10%]">
        <div className="max-w-[58%]">
          <h1 className="font-display text-[clamp(2rem,5vw,4.5rem)] font-bold leading-[0.95] tracking-tight text-[#F5F1E8]">
            {content.heading}
          </h1>
          {content.subheading && (
            <p className="mt-3 font-display text-[clamp(1rem,2vw,1.75rem)] italic text-[#22d3ee]">
              {content.subheading}
            </p>
          )}
          {content.body && (
            <p className="mt-4 max-w-lg text-[clamp(0.65rem,1.1vw,0.95rem)] leading-relaxed text-[#9CA3AF]">
              {content.body}
            </p>
          )}
          {content.footer && (
            <p className="mt-6 text-[10px] uppercase tracking-[0.2em] text-[#6b7280]">
              {content.footer}
            </p>
          )}
        </div>
      </div>

      {/* Corner badge */}
      <div className="absolute right-[8%] top-[8%] rounded border border-[#22d3ee]/30 bg-black/40 px-2 py-1 text-[9px] uppercase tracking-widest text-[#22d3ee]/90 backdrop-blur-sm">
        Feature Pitch
      </div>
    </SlideFrame>
  );
}
