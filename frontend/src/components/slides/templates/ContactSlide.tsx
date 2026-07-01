import type { SlideContent } from "@/types/slide";
import { EditableText } from "../editing/EditableText";
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
            : "bg-[var(--slide-bg,#0a0a0c)]"
        }`}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.06),transparent_60%)]" />

      <div className="relative flex h-full flex-col items-center justify-center p-[10%] text-center">
        <div className="mb-6 h-px w-16 bg-gradient-to-r from-transparent via-[var(--slide-accent,#22d3ee)] to-transparent" />
        <EditableText
          k="heading"
          as="h2"
          className="font-display text-[clamp(1.75rem,3.5vw,3rem)] font-semibold text-[var(--slide-text,#F5F1E8)]"
          value={content.heading}
        />
        {content.subheading && (
          <EditableText
            k="subheading"
            as="p"
            className="mt-3 text-sm text-[var(--slide-accent,#22d3ee)]"
            value={content.subheading}
          />
        )}
        {content.body && (
          <EditableText
            k="body"
            as="p"
            multiline
            className="mt-6 max-w-md whitespace-pre-line text-sm leading-relaxed text-[var(--slide-text-muted,#9CA3AF)]"
            value={content.body}
          />
        )}
        {content.footer && (
          <EditableText
            k="footer"
            as="p"
            className="mt-8 font-display text-lg italic text-[var(--slide-text,#F5F1E8)]/80"
            value={content.footer}
          />
        )}
        <div className="mt-6 h-px w-16 bg-gradient-to-r from-transparent via-[var(--slide-accent,#22d3ee)]/50 to-transparent" />
      </div>
    </SlideFrame>
  );
}
