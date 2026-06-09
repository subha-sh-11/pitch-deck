import type { SlideContent } from "@/types/slide";
import { EditableText } from "../editing/EditableText";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";

interface LoglineSlideProps {
  content: SlideContent;
}

export function LoglineSlide({ content }: LoglineSlideProps) {
  return (
    <SlideFrame imageUrl={content.imageUrl}>
      <div
        className={`absolute inset-0 ${
          content.imageUrl
            ? "bg-gradient-to-r from-black/90 via-black/55 to-black/25"
            : "bg-gradient-to-br from-[#080808] via-[#101014] to-[#0a0a0c]"
        }`}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(34,211,238,0.06),transparent_55%)]" />

      <div className="relative flex h-full items-center px-[10%]">
        <div className="mr-8 h-[45%] w-1 shrink-0 bg-gradient-to-b from-[var(--slide-accent,#22d3ee)] via-[var(--slide-accent,#22d3ee)]/60 to-transparent" />
        <div className="max-w-[85%]">
          <SlideLabel>
            <EditableText k="heading" as="span" value={content.heading || "Logline"} />
          </SlideLabel>
          <EditableText
            k="body"
            as="p"
            multiline
            className="mt-6 whitespace-pre-line font-display text-[clamp(1.25rem,2.8vw,2.25rem)] font-medium leading-snug text-[#F5F1E8]"
            value={content.body ?? ""}
          />
        </div>
      </div>
    </SlideFrame>
  );
}
