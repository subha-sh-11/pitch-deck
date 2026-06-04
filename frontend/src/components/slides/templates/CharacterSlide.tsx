import type { SlideContent } from "@/types/slide";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";

interface CharacterSlideProps {
  content: SlideContent;
}

export function CharacterSlide({ content }: CharacterSlideProps) {
  const characters = content.characters ?? [];

  return (
    <SlideFrame imageUrl={content.imageUrl}>
      <div
        className={`absolute inset-0 ${
          content.imageUrl ? "bg-black/55" : "bg-gradient-to-br from-[#0a0a0c] to-[#141418]"
        }`}
      />
      <div className="relative flex h-full flex-col p-[7%]">
        <SlideLabel>{content.heading || "Characters"}</SlideLabel>
        <div className="mt-5 grid flex-1 grid-cols-3 gap-4">
          {characters.map((char) => (
            <div
              key={char.name}
              className="flex flex-col rounded-lg border border-white/[0.08] bg-white/[0.02] p-4"
            >
              <div className="mb-3 h-20 w-full rounded-md bg-gradient-to-br from-[#8A4B2A]/40 via-[#2A2A2A] to-[#3F5F4A]/30" />
              <h3 className="font-display text-xl font-semibold text-[#F5F1E8]">
                {char.name}
              </h3>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#22d3ee]">
                {char.role}
              </p>
              <p className="mt-2 flex-1 text-xs leading-relaxed text-[#9CA3AF]">
                {char.description}
              </p>
              {char.wound && (
                <p className="mt-2 border-t border-white/[0.06] pt-2 text-[10px] italic text-[#6b7280]">
                  Wound: {char.wound}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
