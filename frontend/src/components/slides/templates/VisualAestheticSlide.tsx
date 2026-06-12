import type { SlideContent } from "@/types/slide";
import { EditableText } from "../editing/EditableText";
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
        <SlideLabel>
          <EditableText k="heading" as="span" value={content.heading || "Visual Aesthetic"} />
        </SlideLabel>
        {content.body && (
          <EditableText
            k="body"
            as="p"
            multiline
            className="mt-2 whitespace-pre-line text-xs text-[#9CA3AF]"
            value={content.body}
          />
        )}
        <div className="mt-5 grid flex-1 grid-cols-3 grid-rows-2 gap-2">
          {blocks.map((block, i) => (
            <div
              key={i}
              className={`relative flex flex-col justify-end overflow-hidden rounded-md p-3 ${
                i === 0 ? "col-span-2 row-span-1" : ""
              }`}
              style={{ backgroundColor: block.color }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <EditableText
                k={`mood-${i}-label`}
                as="span"
                className="relative text-[11px] font-semibold uppercase tracking-wider text-white/90"
                value={block.label}
              />
            </div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
