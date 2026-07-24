import type { SlideContent } from "@/types/slide";
import { EditableText } from "../editing/EditableText";
import { SlideFrame } from "../shared/SlideFrame";
import { useSlideTreatment } from "../shared/SlideTreatmentContext";

interface CoverSlideProps {
  content: SlideContent;
  /** Layout variant from the backend layout agent: "full_bleed" | "centered_title". */
  layout?: string;
}

// Display-type scale ladder driven by the reference profile's typography.scale — oversized
// references get genuinely poster-sized titles. Full class literals so Tailwind JIT sees them.
const HERO_TITLE_SIZE = {
  default: "text-[clamp(2rem,5cqw,4.5rem)]",
  large: "text-[clamp(2.4rem,6.2cqw,5.6rem)]",
  oversized: "text-[clamp(2.8rem,7.6cqw,7rem)]",
} as const;
const CENTERED_TITLE_SIZE = {
  default: "text-[clamp(2.2rem,5.5cqw,5rem)]",
  large: "text-[clamp(2.6rem,6.6cqw,6rem)]",
  oversized: "text-[clamp(3rem,8.2cqw,7.4rem)]",
} as const;

export function CoverSlide({ content, layout }: CoverSlideProps) {
  const hasImage = Boolean(content.imageUrl);
  const t = useSlideTreatment();
  // The reference profile's title placement wins when it parses clearly; otherwise the backend
  // layout variant decides (as before).
  const centered =
    t.titlePlacement === "centered"
      ? true
      : t.titlePlacement === "lower-left"
        ? false
        : layout === "centered_title";

  return (
    <SlideFrame imageUrl={content.imageUrl}>
      {/* Base tint — translucent over a generated image, theme/profile ground without one */}
      <div
        className={`absolute inset-0 ${hasImage ? "bg-black/25" : ""}`}
        style={
          hasImage
            ? undefined
            : { background: "var(--slide-ground, var(--slide-bg, #0a0a0c))" }
        }
      />

      {/* Spotlight from top-right — dropped when the references call for high whitespace */}
      {t.whitespace !== "airy" && (
        <div className="absolute -right-20 -top-20 h-[70%] w-[60%] rounded-full bg-gradient-to-bl from-[var(--slide-accent,#22d3ee)]/12 via-[#A9C6C7]/8 to-transparent blur-3xl" />
      )}

      {/* Scrim so the title stays legible over imagery */}
      <div
        className={`absolute inset-0 ${
          centered
            ? "bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.55),rgba(0,0,0,0.25)_60%,transparent)]"
            : "bg-gradient-to-tr from-black/90 via-black/35 to-transparent"
        }`}
      />

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.6)_100%)]" />

      {centered ? (
        /* ── Centered typographic cover (no image, or symmetric design language) ── */
        <div className="relative z-10 flex h-full flex-col items-center justify-center p-[calc(8%_+_var(--slide-pad-delta,0%))] text-center">
          <div
            className="mb-6 h-px w-24"
            style={{ background: "linear-gradient(to right, transparent, var(--slide-accent), transparent)" }}
          />
          <EditableText
            k="heading"
            as="h1"
            className={`max-w-[80%] font-display ${CENTERED_TITLE_SIZE[t.displayScale]} font-bold leading-[0.95] tracking-tight text-[var(--slide-text,#F5F1E8)]`}
            value={content.heading}
          />
          {content.subheading && (
            <EditableText
              k="subheading"
              as="p"
              className="mt-4 font-display text-[clamp(1rem,2cqw,1.6rem)] italic"
              style={{ color: "var(--slide-accent)" }}
              value={content.subheading}
            />
          )}
          {content.body && (
            <EditableText
              k="body"
              as="p"
              multiline
              className="mt-5 max-w-xl whitespace-pre-line text-[clamp(0.65rem,1.1cqw,0.95rem)] leading-relaxed text-[var(--slide-text-muted,#9CA3AF)]"
              value={content.body}
            />
          )}
          <div
            className="mt-6 h-px w-24"
            style={{ background: "linear-gradient(to right, transparent, var(--slide-accent), transparent)" }}
          />
        </div>
      ) : (
        /* ── Full-bleed hero cover (image-led, bottom-left) ── */
        <>
          <div
            className="absolute bottom-[28%] left-[8%] h-px w-24"
            style={{ background: "linear-gradient(to right, var(--slide-accent), transparent)" }}
          />
          <div className="relative z-10 flex h-full flex-col justify-end p-[calc(8%_+_var(--slide-pad-delta,0%))] pb-[calc(10%_+_var(--slide-pad-delta,0%))]">
            <div className={t.displayScale === "oversized" ? "max-w-[72%]" : "max-w-[58%]"}>
              <EditableText
                k="heading"
                as="h1"
                className={`font-display ${HERO_TITLE_SIZE[t.displayScale]} font-bold leading-[0.95] tracking-tight text-[var(--slide-text,#F5F1E8)]`}
                value={content.heading}
              />
              {content.subheading && (
                <EditableText
                  k="subheading"
                  as="p"
                  className="mt-3 font-display text-[clamp(1rem,2cqw,1.75rem)] italic"
                  style={{ color: "var(--slide-accent)" }}
                  value={content.subheading}
                />
              )}
              {content.body && (
                <EditableText
                  k="body"
                  as="p"
                  multiline
                  className="mt-4 max-w-lg whitespace-pre-line text-[clamp(0.65rem,1.1cqw,0.95rem)] leading-relaxed text-[var(--slide-text-muted,#9CA3AF)]"
                  value={content.body}
                />
              )}
              {content.footer && (
                <EditableText
                  k="footer"
                  as="p"
                  className="mt-6 text-[10px] uppercase tracking-[0.2em] text-[var(--slide-text-muted,#6b7280)]"
                  value={content.footer}
                />
              )}
            </div>
          </div>
        </>
      )}

    </SlideFrame>
  );
}
