"use client";

import type { SlideContent } from "@/types/slide";
import { CardControls } from "../editing/CardControls";
import { EditableText } from "../editing/EditableText";
import { MovableCard } from "../editing/MovableCard";
import { useSlideEdit } from "../editing/SlideEditContext";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";

interface CharacterSlideProps {
  content: SlideContent;
}

export function CharacterSlide({ content }: CharacterSlideProps) {
  const characters = content.characters ?? [];
  const { patchContent } = useSlideEdit();

  const duplicate = (i: number) =>
    patchContent({ characters: [...characters, { ...characters[i] }] });
  const remove = (i: number) =>
    patchContent({ characters: characters.filter((_, j) => j !== i) });
  const setImage = (i: number, url: string) =>
    patchContent({ characters: characters.map((c, j) => (j === i ? { ...c, imageUrl: url } : c)) });

  return (
    <SlideFrame imageUrl={content.imageUrl}>
      {/* A grid of per-character portraits; a slide-level background image shows behind them. */}
      <div
        className={`absolute inset-0 ${content.imageUrl ? "bg-black/70" : "bg-[var(--slide-bg,#0a0a0c)]"}`}
      />
      <div className="relative flex h-full flex-col p-[7%]">
        <SlideLabel>
          <EditableText k="heading" as="span" value={content.heading || "Characters"} />
        </SlideLabel>
        <div className="mt-5 grid flex-1 grid-cols-3 gap-4">
          {characters.map((char, i) => (
            <MovableCard
              key={i}
              ck={`char-${i}`}
              className="group relative flex min-h-[220px] flex-col justify-end overflow-hidden rounded-lg border border-white/[0.08] p-4"
              style={char.imageUrl ? undefined : { background: "rgba(255,255,255,0.02)" }}
            >
              <CardControls
                onDuplicate={() => duplicate(i)}
                onDelete={() => remove(i)}
                onSetImage={(url) => setImage(i, url)}
              />
              {char.imageUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={char.imageUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  {/* scrim so the name/role stay legible over the portrait */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/10" />
                </>
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#8A4B2A]/40 via-[#2A2A2A] to-[#3F5F4A]/30" />
              )}
              <EditableText
                k={`char-${i}-name`}
                as="h3"
                className="relative font-display text-xl font-semibold text-[var(--slide-text,#F5F1E8)]"
                value={char.name}
              />
              <EditableText
                k={`char-${i}-role`}
                as="p"
                className="relative mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--slide-accent,#22d3ee)]"
                value={char.role}
              />
              <EditableText
                k={`char-${i}-desc`}
                as="p"
                multiline
                className="relative mt-2 line-clamp-3 whitespace-pre-line text-xs leading-relaxed text-white/85"
                value={char.description}
              />
              {char.wound && (
                <EditableText
                  k={`char-${i}-wound`}
                  as="p"
                  className="relative mt-2 text-[10px] italic text-white/60"
                  value={`Wound: ${char.wound}`}
                />
              )}
            </MovableCard>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
