import type { SlideContent } from "@/types/slide";
import { EditableText } from "../editing/EditableText";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";

interface CharacterSlideProps {
  content: SlideContent;
}

export function CharacterSlide({ content }: CharacterSlideProps) {
  // Primary cast only — cap at 4 so the row always fits the frame cleanly.
  const characters = (content.characters ?? []).slice(0, 4);
  const cols = Math.min(Math.max(characters.length, 1), 4);

  return (
    <SlideFrame>
      {/* Dark, even ground — each card carries its own portrait, so no bleeding backdrop. */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0c] to-[#141418]" />
      <div className="relative flex h-full min-h-0 flex-col p-[7%]">
        <SlideLabel>
          <EditableText k="heading" as="span" value={content.heading || "Characters"} />
        </SlideLabel>
        <div
          className="mt-5 grid min-h-0 flex-1 gap-4"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {characters.map((char, i) => (
            <div
              key={i}
              className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.02]"
            >
              {/* Portrait — the generated per-character image, or a tonal fallback. */}
              <div className="relative min-h-0 flex-1">
                {char.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={char.imageUrl}
                    alt={char.name}
                    className="absolute inset-0 h-full w-full object-cover object-top"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#8A4B2A]/40 via-[#2A2A2A] to-[#3F5F4A]/30" />
                )}
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 to-transparent" />
              </div>
              {/* Identity block */}
              <div className="shrink-0 p-3">
                <EditableText
                  k={`char-${i}-name`}
                  as="h3"
                  className="font-display text-lg font-semibold leading-tight text-[#F5F1E8]"
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
                  className="mt-1.5 line-clamp-3 whitespace-pre-line text-[11px] leading-relaxed text-[#9CA3AF]"
                  value={char.description}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
