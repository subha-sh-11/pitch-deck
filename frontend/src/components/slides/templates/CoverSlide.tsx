import type { SlideContent } from "@/types/slide";
import { EditableText } from "../editing/EditableText";
import { SlideFrame } from "../shared/SlideFrame";

interface CoverSlideProps {
  content: SlideContent;
  /** Layout variant from the backend layout agent: "full_bleed" | "centered_title". */
  layout?: string;
}

export function CoverSlide({ content, layout }: CoverSlideProps) {
  const hasImage = Boolean(content.imageUrl);
  const centered = layout === "centered_title";

  return (
    <SlideFrame imageUrl={content.imageUrl}>
      {/* Base tint — translucent over a generated image, full gradient without one */}
      <div
        className={`absolute inset-0 ${
          hasImage
            ? "bg-black/25"
            : "bg-gradient-to-br from-[#0c0c0e] via-[#141418] to-[#080808]"
        }`}
      />

      {/* Spotlight from top-right */}
      <div className="absolute -right-20 -top-20 h-[70%] w-[60%] rounded-full bg-gradient-to-bl from-[#22d3ee]/12 via-[#A9C6C7]/8 to-transparent blur-3xl" />

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
        <div className="relative z-10 flex h-full flex-col items-center justify-center p-[8%] text-center">
          <div
            className="mb-6 h-px w-24"
            style={{ background: "linear-gradient(to right, transparent, var(--slide-accent), transparent)" }}
          />
          <EditableText
            k="heading"
            as="h1"
            className="max-w-[80%] font-display text-[clamp(2.2rem,5.5vw,5rem)] font-bold leading-[0.95] tracking-tight text-[#F5F1E8]"
            value={content.heading}
          />
          {content.subheading && (
            <EditableText
              k="subheading"
              as="p"
              className="mt-4 font-display text-[clamp(1rem,2vw,1.6rem)] italic"
              style={{ color: "var(--slide-accent)" }}
              value={content.subheading}
            />
          )}
          {content.body && (
            <EditableText
              k="body"
              as="p"
              multiline
              className="mt-5 max-w-xl whitespace-pre-line text-[clamp(0.65rem,1.1vw,0.95rem)] leading-relaxed text-[#9CA3AF]"
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
          <div className="relative z-10 flex h-full flex-col justify-end p-[8%] pb-[10%]">
            <div className="max-w-[58%]">
              <EditableText
                k="heading"
                as="h1"
                className="font-display text-[clamp(2rem,5vw,4.5rem)] font-bold leading-[0.95] tracking-tight text-[#F5F1E8]"
                value={content.heading}
              />
              {content.subheading && (
                <EditableText
                  k="subheading"
                  as="p"
                  className="mt-3 font-display text-[clamp(1rem,2vw,1.75rem)] italic"
                  style={{ color: "var(--slide-accent)" }}
                  value={content.subheading}
                />
              )}
              {content.body && (
                <EditableText
                  k="body"
                  as="p"
                  multiline
                  className="mt-4 max-w-lg whitespace-pre-line text-[clamp(0.65rem,1.1vw,0.95rem)] leading-relaxed text-[#9CA3AF]"
                  value={content.body}
                />
              )}
              {content.footer && (
                <EditableText
                  k="footer"
                  as="p"
                  className="mt-6 text-[10px] uppercase tracking-[0.2em] text-[#6b7280]"
                  value={content.footer}
                />
              )}
            </div>
          </div>
        </>
      )}

      {/* Corner badge */}
      <div
        className="absolute right-[8%] top-[8%] rounded border bg-black/40 px-2 py-1 text-[9px] uppercase tracking-widest backdrop-blur-sm"
        style={{
          borderColor: "color-mix(in srgb, var(--slide-accent) 35%, transparent)",
          color: "var(--slide-accent)",
        }}
      >
        Feature Pitch
      </div>
    </SlideFrame>
  );
}
