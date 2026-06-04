import type { SlideContent } from "@/types/slide";
import { SlideFrame } from "../shared/SlideFrame";

interface ContactSlideProps {
  content: SlideContent;
}

export function ContactSlide({ content }: ContactSlideProps) {
  return (
    <SlideFrame imageUrl={content.imageUrl}>
      <div
        className={`absolute inset-0 ${
          content.imageUrl
            ? "bg-black/70"
            : "bg-gradient-to-b from-[#101010] via-[#0a0a0c] to-[#080808]"
        }`}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.06),transparent_60%)]" />

      <div className="relative flex h-full flex-col items-center justify-center p-[10%] text-center">
        <div className="mb-6 h-px w-16 bg-gradient-to-r from-transparent via-[#22d3ee] to-transparent" />
        <h2 className="font-display text-[clamp(1.75rem,3.5vw,3rem)] font-semibold text-[#F5F1E8]">
          {content.heading}
        </h2>
        {content.subheading && (
          <p className="mt-3 text-sm text-[#22d3ee]">{content.subheading}</p>
        )}
        {content.body && (
          <p className="mt-6 max-w-md text-sm leading-relaxed text-[#9CA3AF]">
            {content.body}
          </p>
        )}
        {content.footer && (
          <p className="mt-8 font-display text-lg italic text-[#F5F1E8]/80">
            {content.footer}
          </p>
        )}
        <div className="mt-6 h-px w-16 bg-gradient-to-r from-transparent via-[#22d3ee]/50 to-transparent" />
      </div>
    </SlideFrame>
  );
}
