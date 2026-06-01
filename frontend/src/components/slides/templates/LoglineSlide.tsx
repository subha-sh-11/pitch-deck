import type { SlideContent } from "@/types/slide";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";

interface LoglineSlideProps {
  content: SlideContent;
}

export function LoglineSlide({ content }: LoglineSlideProps) {
  return (
    <SlideFrame>
      <div className="absolute inset-0 bg-gradient-to-br from-[#080808] via-[#101014] to-[#0a0a0c]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(34,211,238,0.06),transparent_55%)]" />

      <div className="relative flex h-full items-center px-[10%]">
        <div className="mr-8 h-[45%] w-1 shrink-0 bg-gradient-to-b from-[var(--slide-accent,#22d3ee)] via-[var(--slide-accent,#22d3ee)]/60 to-transparent" />
        <div className="max-w-[85%]">
          <SlideLabel>{content.heading || "Logline"}</SlideLabel>
          <p className="mt-6 font-display text-[clamp(1.25rem,2.8vw,2.25rem)] font-medium leading-snug text-[#F5F1E8]">
            {content.body}
          </p>
        </div>
      </div>
    </SlideFrame>
  );
}
