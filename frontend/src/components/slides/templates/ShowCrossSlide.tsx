import type { SlideContent } from "@/types/slide";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";

interface ShowCrossSlideProps {
  content: SlideContent;
}

export function ShowCrossSlide({ content }: ShowCrossSlideProps) {
  const comps = content.comps ?? [];

  return (
    <SlideFrame>
      <div className="absolute inset-0 bg-gradient-to-b from-[#101010] to-[#080808]" />
      <div className="relative flex h-full flex-col p-[7%]">
        <SlideLabel>{content.heading || "Show Cross"}</SlideLabel>
        <div className="mt-5 grid min-h-0 flex-1 grid-cols-3 gap-4">
          {comps.map((comp) => (
            <div
              key={comp.title}
              className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/[0.08]"
            >
              <div className="relative min-h-0 flex-1 bg-gradient-to-b from-[#2A2A2A] via-[#1a1a1f] to-[#3F5F4A]/20">
                {comp.posterUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={comp.posterUrl}
                    alt={comp.title}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
                <div className="absolute bottom-2 left-3 right-3">
                  <p className="font-display text-base font-bold leading-tight text-[#F5F1E8]">
                    {comp.title}
                  </p>
                </div>
              </div>
              <div className="shrink-0 p-3">
                <p className="line-clamp-3 text-[11px] leading-relaxed text-[#9CA3AF]">
                  {comp.note}
                </p>
              </div>
            </div>
          ))}
        </div>
        {content.body && (
          <p
            className="mt-3 shrink-0 border-t border-white/[0.06] pt-3 text-center text-xs italic"
            style={{ color: "var(--slide-accent)" }}
          >
            {content.body}
          </p>
        )}
      </div>
    </SlideFrame>
  );
}
