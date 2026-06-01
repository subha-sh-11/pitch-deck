import type { SlideContent } from "@/types/slide";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";

interface StoryWorldSlideProps {
  content: SlideContent;
}

export function StoryWorldSlide({ content }: StoryWorldSlideProps) {
  const locations =
    content.items ??
    [
      { title: "Rooftop Water Tank", description: "Silent villain" },
      { title: "Apartment Corridors", description: "Urban maze" },
      { title: "Family Homes", description: "Emotional anchor" },
      { title: "City Search", description: "Desperate scale" },
    ];

  return (
    <SlideFrame>
      <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-[#101010] to-[#0c0c0e]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(63,95,74,0.12),transparent_60%)]" />

      <div className="relative flex h-full flex-col p-[7%]">
        <SlideLabel>{content.heading || "Story World"}</SlideLabel>
        {content.body && (
          <p className="mt-3 max-w-xl text-sm text-[#9CA3AF]">{content.body}</p>
        )}
        <div className="mt-6 grid flex-1 grid-cols-2 gap-3">
          {locations.map((loc) => (
            <div
              key={loc.title}
              className="group relative overflow-hidden rounded-lg border border-white/[0.08] p-4"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent" />
              <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-[#3F5F4A]/20 blur-xl" />
              <h3 className="relative font-display text-lg font-semibold text-[#F5F1E8]">
                {loc.title}
              </h3>
              <p className="relative mt-1 text-xs text-[#9CA3AF]">{loc.description}</p>
            </div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
