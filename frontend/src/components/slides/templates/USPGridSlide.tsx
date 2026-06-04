import type { SlideContent } from "@/types/slide";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";

interface USPGridSlideProps {
  content: SlideContent;
}

export function USPGridSlide({ content }: USPGridSlideProps) {
  const bullets = content.bullets ?? [];

  return (
    <SlideFrame imageUrl={content.imageUrl}>
      <div
        className={`absolute inset-0 ${content.imageUrl ? "bg-black/65" : "bg-[#0a0a0c]"}`}
      />
      <div className="relative flex h-full flex-col p-[7%]">
        <SlideLabel>{content.heading || "Unique Selling Points"}</SlideLabel>
        <div className="mt-6 grid flex-1 grid-cols-2 gap-3 content-start">
          {bullets.map((bullet, i) => (
            <div
              key={bullet}
              className="flex items-start gap-3 rounded-lg border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-[#22d3ee]/15 text-[10px] font-bold text-[#22d3ee]">
                {i + 1}
              </span>
              <p className="text-sm leading-snug text-[#F5F1E8]">{bullet}</p>
            </div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
