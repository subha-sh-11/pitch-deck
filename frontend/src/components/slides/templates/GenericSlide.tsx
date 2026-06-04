import type { SlideContent } from "@/types/slide";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";

interface GenericSlideProps {
  content: SlideContent;
}

export function GenericSlide({ content }: GenericSlideProps) {
  return (
    <SlideFrame imageUrl={content.imageUrl}>
      <div
        className={`absolute inset-0 ${
          content.imageUrl ? "bg-black/65" : "bg-gradient-to-br from-[#0a0a0c] to-[#141418]"
        }`}
      />
      <div className="relative flex h-full flex-col p-[7%]">
        <SlideLabel>{content.heading}</SlideLabel>
        {content.body && (
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-[#9CA3AF]">
            {content.body}
          </p>
        )}
        {content.bullets && (
          <ul className="mt-5 space-y-3">
            {content.bullets.map((b) => (
              <li key={b} className="flex gap-3 text-sm text-[#F5F1E8]">
                <span className="text-[#22d3ee]">◆</span>
                {b}
              </li>
            ))}
          </ul>
        )}
      </div>
    </SlideFrame>
  );
}
