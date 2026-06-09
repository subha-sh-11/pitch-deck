import type { SlideContent } from "@/types/slide";
import { EditableText } from "../editing/EditableText";
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
        <SlideLabel>
          <EditableText k="heading" as="span" value={content.heading} />
        </SlideLabel>
        {content.body && (
          <EditableText
            k="body"
            as="p"
            multiline
            className="mt-5 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-[#9CA3AF]"
            value={content.body}
          />
        )}
        {content.bullets && (
          <ul className="mt-5 space-y-3">
            {content.bullets.map((b, i) => (
              <li key={i} className="flex gap-3 text-sm text-[#F5F1E8]">
                <span className="text-[#22d3ee]">◆</span>
                <EditableText
                  k={`bullet-${i}`}
                  as="span"
                  multiline
                  className="whitespace-pre-line"
                  value={b}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </SlideFrame>
  );
}
