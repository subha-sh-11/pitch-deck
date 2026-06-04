import type { SlideContent } from "@/types/slide";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";

interface VisualAestheticSlideProps {
  content: SlideContent;
}

export function VisualAestheticSlide({ content }: VisualAestheticSlideProps) {
  const blocks = content.moodBlocks ?? [];

  return (
    <SlideFrame imageUrl={content.imageUrl}>
      <div
        className={`absolute inset-0 ${content.imageUrl ? "bg-black/45" : "bg-[#0a0a0c]"}`}
      />
      <div className="relative flex h-full flex-col p-[7%]">
        <SlideLabel>{content.heading || "Visual Aesthetic"}</SlideLabel>
        {content.body && (
          <p className="mt-2 text-xs text-[#9CA3AF]">{content.body}</p>
        )}
        <div className="mt-5 grid flex-1 grid-cols-3 grid-rows-2 gap-2">
          {blocks.map((block, i) => (
            <div
              key={block.label}
              className={`relative flex flex-col justify-end overflow-hidden rounded-md p-3 ${
                i === 0 ? "col-span-2 row-span-1" : ""
              }`}
              style={{ backgroundColor: block.color }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <span className="relative text-[11px] font-semibold uppercase tracking-wider text-white/90">
                {block.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
