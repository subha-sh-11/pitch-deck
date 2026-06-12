import type { SlideContent } from "@/types/slide";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";

interface LoglineSlideProps {
  content: SlideContent;
  /** Layout variant: "centered_statement" (title-card centre) | "left_rail" (long copy). */
  layout?: string;
}

export function LoglineSlide({ content, layout }: LoglineSlideProps) {
  const leftRail = layout === "left_rail";

  return (
    <SlideFrame imageUrl={content.imageUrl}>
      <div
        className={`absolute inset-0 ${
          content.imageUrl
            ? "bg-gradient-to-r from-black/90 via-black/55 to-black/25"
            : "bg-gradient-to-br from-[#080808] via-[#101014] to-[#0a0a0c]"
        }`}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(34,211,238,0.06),transparent_55%)]" />

      {leftRail ? (
        /* ── Long logline: anchored left with the accent rail ── */
        <div className="relative flex h-full items-center px-[10%]">
          <div className="mr-8 h-[45%] w-1 shrink-0 bg-gradient-to-b from-[var(--slide-accent,#22d3ee)] via-[var(--slide-accent,#22d3ee)]/60 to-transparent" />
          <div className="max-w-[85%]">
            <SlideLabel>{content.heading || "Logline"}</SlideLabel>
            <p className="mt-6 font-display text-[clamp(1.25rem,2.8vw,2.25rem)] font-medium leading-snug text-[#F5F1E8]">
              {content.body}
            </p>
          </div>
        </div>
      ) : (
        /* ── Tight logline: lands centred like a title card ── */
        <div className="relative flex h-full flex-col items-center justify-center px-[12%] text-center">
          <SlideLabel>{content.heading || "Logline"}</SlideLabel>
          <p className="mt-7 max-w-4xl font-display text-[clamp(1.4rem,3.2vw,2.6rem)] font-medium leading-snug text-[#F5F1E8]">
            {content.body}
          </p>
          <div
            className="mt-8 h-px w-28"
            style={{ background: "linear-gradient(to right, transparent, var(--slide-accent), transparent)" }}
          />
        </div>
      )}
    </SlideFrame>
  );
}
