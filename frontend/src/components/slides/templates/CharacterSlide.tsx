import type { SlideContent } from "@/types/slide";
import { EditableText } from "../editing/EditableText";
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
        <SlideLabel>
          <EditableText k="heading" as="span" value={content.heading || "Characters"} />
        </SlideLabel>
        <div className="mt-5 grid flex-1 grid-cols-3 gap-4">
          {characters.map((char, i) => (
            <div
              key={i}
              className="flex flex-col rounded-lg border border-white/[0.08] bg-white/[0.02] p-4"
            >
              <div className="mb-3 h-20 w-full rounded-md bg-gradient-to-br from-[#8A4B2A]/40 via-[#2A2A2A] to-[#3F5F4A]/30" />
              <EditableText
                k={`char-${i}-name`}
                as="h3"
                className="font-display text-xl font-semibold text-[#F5F1E8]"
                value={char.name}
              />
              <EditableText
                k={`char-${i}-role`}
                as="p"
                className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#22d3ee]"
                value={char.role}
              />
              <EditableText
                k={`char-${i}-desc`}
                as="p"
                multiline
                className="mt-2 flex-1 whitespace-pre-line text-xs leading-relaxed text-[#9CA3AF]"
                value={char.description}
              />
              {char.wound && (
                <EditableText
                  k={`char-${i}-wound`}
                  as="p"
                  className="mt-2 border-t border-white/[0.06] pt-2 text-[10px] italic text-[#6b7280]"
                  value={`Wound: ${char.wound}`}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
