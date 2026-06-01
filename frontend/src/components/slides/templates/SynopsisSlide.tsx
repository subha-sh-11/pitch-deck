import type { SlideContent } from "@/types/slide";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";

interface SynopsisSlideProps {
  content: SlideContent;
}

export function SynopsisSlide({ content }: SynopsisSlideProps) {
  const paragraphs = content.body?.split(/\n\n+/).filter(Boolean) ?? [content.body ?? ""];

  return (
    <SlideFrame>
      <div className="absolute inset-0 bg-[#0a0a0c]" />
      <div className="relative grid h-full grid-cols-2 gap-0">
        <div className="flex flex-col justify-center p-[8%] pr-[6%]">
          <SlideLabel>{content.heading || "Synopsis"}</SlideLabel>
          <div className="mt-5 space-y-4">
            {paragraphs.map((para) => (
              <p
                key={para.slice(0, 40)}
                className="text-[clamp(0.65rem,1vw,0.85rem)] leading-relaxed text-[#9CA3AF]"
              >
                {para}
              </p>
            ))}
          </div>
        </div>
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#2A2A2A] via-[#3F5F4A]/30 to-[#080808]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_40%,rgba(169,198,199,0.15),transparent_50%)]" />
          <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-[#A9C6C7]/20 to-transparent" />
          <div className="absolute inset-4 rounded border border-white/[0.06]" />
          <div className="absolute bottom-6 left-6 right-6">
            <p className="text-[10px] uppercase tracking-widest text-[#22d3ee]/80">
              Hyderabad · Rooftop · Rising Water
            </p>
          </div>
        </div>
      </div>
    </SlideFrame>
  );
}
