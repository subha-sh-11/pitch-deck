import type { SlideContent } from "@/types/slide";
import { EditableText } from "../editing/EditableText";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";

interface SynopsisSlideProps {
  content: SlideContent;
}

export function SynopsisSlide({ content }: SynopsisSlideProps) {
  return (
    <SlideFrame>
      <div className="absolute inset-0 bg-[#0a0a0c]" />
      <div className="relative grid h-full grid-cols-2 gap-0">
        <div className="flex flex-col justify-center p-[8%] pr-[6%]">
          <SlideLabel>
            <EditableText k="heading" as="span" value={content.heading || "Synopsis"} />
          </SlideLabel>
          <EditableText
            k="body"
            as="div"
            multiline
            className="mt-5 whitespace-pre-line text-[clamp(0.65rem,1vw,0.85rem)] leading-relaxed text-[#9CA3AF]"
            value={content.body ?? ""}
          />
        </div>
        <div className="relative overflow-hidden">
          {content.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={content.imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1f] to-[#080808]" />
          )}
          {/* blend the image into the text column */}
          <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-[#0a0a0c]" />
        </div>
      </div>
    </SlideFrame>
  );
}
