import type { SlideAppearance, SlideContent } from "@/types/slide";
import { EditableText } from "../editing/EditableText";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";
import { useSlideTreatment } from "../shared/SlideTreatmentContext";
import { SplitLayout } from "../shared/SplitLayout";

// Logline display sizes ladder up with the reference profile's typography.scale.
// Sized so the logline reads as a statement, not a full-screen quotation.
const RAIL_SIZE = {
  default: "text-[clamp(1.15rem,2.5cqw,2rem)]",
  large: "text-[clamp(1.3rem,3cqw,2.4rem)]",
  oversized: "text-[clamp(1.5rem,3.8cqw,3rem)]",
} as const;
const CENTERED_SIZE = {
  default: "text-[clamp(1.25rem,2.9cqw,2.3rem)]",
  large: "text-[clamp(1.45rem,3.5cqw,2.8rem)]",
  oversized: "text-[clamp(1.7rem,4.3cqw,3.5rem)]",
} as const;

interface LoglineSlideProps {
  content: SlideContent;
  /** Layout variant: "centered_statement" (title-card centre) | "left_rail" (long copy). */
  layout?: string;
  appearance?: SlideAppearance;
}

export function LoglineSlide({ content, layout, appearance }: LoglineSlideProps) {
  const leftRail = layout === "left_rail";
  const comp = appearance?.composition;
  const t = useSlideTreatment();

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
          content.imageUrl ? "bg-gradient-to-r from-black/95 via-black/65 to-black/30" : ""
        }`}
        style={
          content.imageUrl
            ? undefined
            : { background: "var(--slide-ground, var(--slide-bg, #0a0a0c))" }
        }
      />
      {t.whitespace !== "airy" && (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(34,211,238,0.06),transparent_55%)]" />
      )}

      {leftRail ? (
        /* ── Long logline: anchored left with the accent rail ── */
        <div className="relative flex h-full items-center px-[calc(11%_+_var(--slide-pad-delta,0%))]">
          <div className="mr-8 h-[45%] w-1 shrink-0 bg-gradient-to-b from-[var(--slide-accent,#22d3ee)] via-[var(--slide-accent,#22d3ee)]/60 to-transparent" />
          <div className="max-w-[78%]">
            <SlideLabel>
              <EditableText k="heading" as="span" value={content.heading || "Logline"} />
            </SlideLabel>
            <EditableText
              k="body"
              as="p"
              multiline
              className={`mt-8 whitespace-pre-line font-display ${RAIL_SIZE[t.displayScale]} font-medium leading-snug text-[var(--slide-text,#F5F1E8)]`}
              value={content.body ?? ""}
            />
          </div>
        </div>
      ) : (
        /* ── Tight logline: lands centred like a title card ── */
        <div className="relative flex h-full flex-col items-center justify-center px-[calc(12%_+_var(--slide-pad-delta,0%))] text-center">
          <SlideLabel>
            <EditableText k="heading" as="span" value={content.heading || "Logline"} />
          </SlideLabel>
          <EditableText
            k="body"
            as="p"
            multiline
            className={`mt-8 max-w-[70%] whitespace-pre-line font-display ${CENTERED_SIZE[t.displayScale]} font-medium leading-snug text-[var(--slide-text,#F5F1E8)]`}
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
