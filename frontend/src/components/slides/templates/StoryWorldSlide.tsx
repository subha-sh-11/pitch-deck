import type { SlideContent } from "@/types/slide";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";

interface StoryWorldSlideProps {
  content: SlideContent;
}

export function StoryWorldSlide({ content }: StoryWorldSlideProps) {
  const locations = content.items ?? [];

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
