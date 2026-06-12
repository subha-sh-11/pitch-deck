import type { SlideContent } from "@/types/slide";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";

interface StoryWorldSlideProps {
  content: SlideContent;
  /** Layout variant: "atmospheric" (bottom-anchored, location cards) | "caption_panel" (side glass panel over imagery). */
  layout?: string;
}

export function StoryWorldSlide({ content, layout }: StoryWorldSlideProps) {
  const locations = content.items ?? [];
  const captionPanel = layout === "caption_panel";

  if (captionPanel) {
    /* ── Full-bleed imagery with a glass caption panel — prose-led worlds ── */
    return (
      <SlideFrame imageUrl={content.imageUrl}>
        <div
          className={`absolute inset-0 ${
            content.imageUrl
              ? "bg-gradient-to-r from-black/75 via-black/20 to-transparent"
              : "bg-gradient-to-br from-[#0c0c0e] via-[#121216] to-[#080808]"
          }`}
        />
        <div className="relative flex h-full items-center p-[7%]">
          <div className="max-w-[44%] rounded-xl border border-white/[0.08] bg-black/45 p-7 backdrop-blur-md">
            <SlideLabel>{content.heading || "Story World"}</SlideLabel>
            {content.body && (
              <p className="mt-4 text-[clamp(0.75rem,1.15vw,1rem)] leading-relaxed text-[#E8E6E0]">
                {content.body}
              </p>
            )}
            <div
              className="mt-5 h-px w-16"
              style={{ background: "linear-gradient(to right, var(--slide-accent), transparent)" }}
            />
          </div>
        </div>
      </SlideFrame>
    );
  }

  /* ── Atmospheric: bottom-anchored copy + location cards ── */
  return (
    <SlideFrame imageUrl={content.imageUrl}>
      <div
        className={`absolute inset-0 ${
          content.imageUrl
            ? "bg-gradient-to-t from-black/90 via-black/45 to-black/30"
            : "bg-gradient-to-t from-[#080808] via-[#101010] to-[#0c0c0e]"
        }`}
      />

      <div className="relative flex h-full flex-col justify-end p-[8%]">
        <SlideLabel>{content.heading || "Story World"}</SlideLabel>
        {content.body && (
          <p className="mt-4 max-w-2xl text-[clamp(0.8rem,1.2vw,1.05rem)] leading-relaxed text-[#E8E6E0]">
            {content.body}
          </p>
        )}
        {locations.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {locations.map((loc) => (
              <div
                key={loc.title}
                className="rounded-lg border border-white/[0.1] bg-black/30 p-3 backdrop-blur-sm"
              >
                <h3 className="font-display text-sm font-semibold text-[#F5F1E8]">
                  {loc.title}
                </h3>
                {loc.description && (
                  <p className="mt-1 text-xs text-[#9CA3AF]">{loc.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </SlideFrame>
  );
}
