import type { SlideAppearance, SlideContent } from "@/types/slide";
import { EditableText } from "../editing/EditableText";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";
import { SplitLayout } from "../shared/SplitLayout";

interface LoglineSlideProps {
  content: SlideContent;
  /** Layout variant: "centered_statement" (title-card centre) | "left_rail" (long copy). */
  layout?: string;
  appearance?: SlideAppearance;
}

export function LoglineSlide({ content, layout, appearance }: LoglineSlideProps) {
  const leftRail = layout === "left_rail";
  const comp = appearance?.composition;

  // Two-column / framed composition: text in one half, the image in the other.
  if ((comp === "split" || comp === "framed") && content.imageUrl) {
    return (
      <SlideFrame>
        <SplitLayout imageUrl={content.imageUrl} imageSide={appearance?.imageSide} framed={comp === "framed"}>
          <SlideLabel>
            <EditableText k="heading" as="span" value={content.heading || "Logline"} />
          </SlideLabel>
          <EditableText
            k="body"
            as="p"
            multiline
            className="mt-5 whitespace-pre-line font-display text-[clamp(1.1rem,2.4cqw,2rem)] font-medium leading-snug text-[var(--slide-text,#F5F1E8)]"
            value={content.body ?? ""}
          />
        </SplitLayout>
      </SlideFrame>
    );
  }

  return (
    <SlideFrame imageUrl={content.imageUrl}>
      <div
        className={`absolute inset-0 ${
          content.imageUrl
            ? "bg-gradient-to-r from-black/90 via-black/55 to-black/25"
            : "bg-[var(--slide-bg,#0a0a0c)]"
        }`}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(34,211,238,0.06),transparent_55%)]" />

      {leftRail ? (
        /* ── Long logline: anchored left with the accent rail ── */
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
              className="mt-6 whitespace-pre-line font-display text-[clamp(1.25rem,2.8cqw,2.25rem)] font-medium leading-snug text-[var(--slide-text,#F5F1E8)]"
              value={content.body ?? ""}
            />
          </div>
        </div>
      ) : (
        /* ── Tight logline: lands centred like a title card ── */
        <div className="relative flex h-full flex-col items-center justify-center px-[12%] text-center">
          <SlideLabel>
            <EditableText k="heading" as="span" value={content.heading || "Logline"} />
          </SlideLabel>
          <EditableText
            k="body"
            as="p"
            multiline
            className="mt-7 max-w-4xl whitespace-pre-line font-display text-[clamp(1.4rem,3.2cqw,2.6rem)] font-medium leading-snug text-[var(--slide-text,#F5F1E8)]"
            value={content.body ?? ""}
          />
          <div
            className="mt-8 h-px w-28"
            style={{ background: "linear-gradient(to right, transparent, var(--slide-accent), transparent)" }}
          />
        </div>
      )}
    </SlideFrame>
  );
}
