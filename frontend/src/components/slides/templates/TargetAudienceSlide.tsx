import type { SlideContent } from "@/types/slide";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";

interface TargetAudienceSlideProps {
  content: SlideContent;
}

export function TargetAudienceSlide({ content }: TargetAudienceSlideProps) {
  const items = content.items ?? [];

  return (
    <SlideFrame>
      <div className="absolute inset-0 bg-gradient-to-br from-[#0c0c0e] to-[#101010]" />
      <div className="relative flex h-full flex-col p-[7%]">
        <SlideLabel>{content.heading || "Target Audience"}</SlideLabel>
        <div className="mt-6 grid flex-1 grid-cols-2 gap-3 content-start">
          {items.map((item) => (
            <div
              key={item.title}
              className="rounded-lg border border-[#22d3ee]/20 bg-[#22d3ee]/5 p-4"
            >
              <h3 className="text-sm font-semibold text-[#22d3ee]">{item.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#9CA3AF]">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
