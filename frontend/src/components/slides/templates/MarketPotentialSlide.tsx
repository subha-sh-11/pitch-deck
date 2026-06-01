import type { SlideContent } from "@/types/slide";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";

interface MarketPotentialSlideProps {
  content: SlideContent;
}

export function MarketPotentialSlide({ content }: MarketPotentialSlideProps) {
  const items =
    content.items ??
    content.bullets?.map((b) => ({ title: b, description: "" })) ??
    [];

  return (
    <SlideFrame>
      <div className="absolute inset-0 bg-[#0a0a0c]" />
      <div className="relative flex h-full flex-col p-[7%]">
        <SlideLabel>{content.heading || "Market Potential"}</SlideLabel>
        <div className="mt-6 grid flex-1 grid-cols-2 gap-4">
          {items.map((item) => (
            <div
              key={item.title}
              className="flex flex-col justify-between rounded-lg border border-white/[0.08] bg-white/[0.02] p-5"
            >
              <div className="mb-3 h-1 w-8 bg-[#22d3ee]" />
              <h3 className="font-display text-lg font-semibold text-[#F5F1E8]">
                {item.title}
              </h3>
              {item.description && (
                <p className="mt-2 text-xs leading-relaxed text-[#9CA3AF]">
                  {item.description}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
