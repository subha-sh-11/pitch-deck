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
        <div className="mt-5 grid flex-1 grid-cols-3 gap-4">
          {comps.map((comp) => (
            <div
              key={comp.title}
              className="flex flex-col overflow-hidden rounded-lg border border-white/[0.08]"
            >
              <div className="relative aspect-[2/3] bg-gradient-to-b from-[#2A2A2A] via-[#1a1a1f] to-[#3F5F4A]/20">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(34,211,238,0.1),transparent_60%)]" />
                <div className="absolute bottom-3 left-3 right-3">
                  <p className="font-display text-lg font-bold text-[#F5F1E8]">
                    {comp.title}
                  </p>
                </div>
              </div>
              <div className="p-3">
                <p className="text-[11px] leading-relaxed text-[#9CA3AF]">{comp.note}</p>
              </div>
            </div>
          ))}
        </div>
        {content.body && (
          <p className="mt-4 border-t border-white/[0.06] pt-4 text-center text-xs italic text-[#22d3ee]/90">
            {content.body}
          </p>
        )}
      </div>
    </SlideFrame>
  );
}
