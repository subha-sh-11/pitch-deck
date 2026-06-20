import type { SlideContent } from "@/types/slide";
import { EditableText } from "../editing/EditableText";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";

interface GenreBlendSlideProps {
  content: SlideContent;
}

export function GenreBlendSlide({ content }: GenreBlendSlideProps) {
  const items = content.items ?? [];

  return (
    <SlideFrame>
      {/* A grid of per-genre tiles — each genre gets its OWN image; no single shared background. */}
      <div className="absolute inset-0 bg-[var(--slide-bg,#0a0a0c)]" />
      <div className="relative flex h-full flex-col p-[7%]">
        <SlideLabel>
          <EditableText k="heading" as="span" value={content.heading || "Genre Blend"} />
        </SlideLabel>
        <div className="mt-6 grid flex-1 grid-cols-3 gap-4">
          {items.map((item, i) => (
            <div
              key={i}
              className="group relative flex flex-col justify-end overflow-hidden rounded-lg border border-white/[0.08] p-5 transition-colors hover:border-[var(--slide-accent,#22d3ee)]/30"
              style={
                item.imageUrl
                  ? undefined
                  : { background: `linear-gradient(165deg, rgba(255,255,255,0.04) 0%, rgba(0,0,0,0.4) 100%)` }
              }
            >
              {item.imageUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  {/* scrim so the genre label stays legible over its image */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/5" />
                </>
              ) : (
                <div
                  className="absolute inset-0 opacity-40"
                  style={{
                    background: `radial-gradient(circle at ${30 + i * 20}% 20%, rgba(34,211,238,${0.08 + i * 0.04}), transparent 60%)`,
                  }}
                />
              )}
              <span className="relative mb-2 text-[10px] font-bold text-[var(--slide-accent,#22d3ee)]">
                0{i + 1}
              </span>
              <EditableText
                k={`item-${i}-title`}
                as="h3"
                className="relative font-display text-xl font-semibold text-[var(--slide-text,#F5F1E8)]"
                value={item.title}
              />
              <EditableText
                k={`item-${i}-desc`}
                as="p"
                multiline
                className="relative mt-2 whitespace-pre-line text-xs leading-relaxed text-[var(--slide-text-muted,#9CA3AF)]"
                value={item.description}
              />
            </div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
