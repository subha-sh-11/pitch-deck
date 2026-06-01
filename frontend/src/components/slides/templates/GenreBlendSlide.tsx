import type { SlideContent } from "@/types/slide";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";

interface GenreBlendSlideProps {
  content: SlideContent;
}

export function GenreBlendSlide({ content }: GenreBlendSlideProps) {
  const items = content.items ?? [];

  return (
    <SlideFrame>
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0c] to-[#101010]" />
      <div className="relative flex h-full flex-col p-[7%]">
        <SlideLabel>{content.heading || "Genre Blend"}</SlideLabel>
        <div className="mt-6 grid flex-1 grid-cols-3 gap-4">
          {items.map((item, i) => (
            <div
              key={item.title}
              className="group relative flex flex-col justify-end overflow-hidden rounded-lg border border-white/[0.08] p-5 transition-colors hover:border-[#22d3ee]/30"
              style={{
                background: `linear-gradient(165deg, rgba(255,255,255,0.04) 0%, rgba(0,0,0,0.4) 100%)`,
              }}
            >
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  background: `radial-gradient(circle at ${30 + i * 20}% 20%, rgba(34,211,238,${0.08 + i * 0.04}), transparent 60%)`,
                }}
              />
              <span className="relative mb-2 text-[10px] font-bold text-[#22d3ee]">
                0{i + 1}
              </span>
              <h3 className="relative font-display text-xl font-semibold text-[#F5F1E8]">
                {item.title}
              </h3>
              <p className="relative mt-2 text-xs leading-relaxed text-[#9CA3AF]">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
