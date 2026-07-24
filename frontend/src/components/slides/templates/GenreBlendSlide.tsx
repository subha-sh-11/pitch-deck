import type { SlideContent } from "@/types/slide";
import { CardControls } from "../editing/CardControls";
import { EditableText } from "../editing/EditableText";
import { MovableCard } from "../editing/MovableCard";
import { useSlideEdit } from "../editing/SlideEditContext";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";
import { SlideIcon, iconForLabel } from "../shared/SlideIcon";

interface GenreBlendSlideProps {
  content: SlideContent;
}

export function GenreBlendSlide({ content }: GenreBlendSlideProps) {
  const items = content.items ?? [];
  const { patchContent } = useSlideEdit();
  const duplicate = (i: number) => patchContent({ items: [...items, { ...items[i] }] });
  const remove = (i: number) => patchContent({ items: items.filter((_, j) => j !== i) });
  const setImage = (i: number, url: string) =>
    patchContent({ items: items.map((it, j) => (j === i ? { ...it, imageUrl: url } : it)) });

  return (
    <SlideFrame imageUrl={content.imageUrl}>
      {/* A grid of per-genre tiles; a slide-level background image shows behind them. */}
      <div
        className={`absolute inset-0 ${content.imageUrl ? "bg-black/70" : ""}`}
        style={
          content.imageUrl
            ? undefined
            : { background: "var(--slide-ground, var(--slide-bg, #0a0a0c))" }
        }
      />
      <div className="relative flex h-full flex-col p-[calc(7%_+_var(--slide-pad-delta,0%))]">
        <SlideLabel>
          <EditableText k="heading" as="span" value={content.heading || "Genre Blend"} />
        </SlideLabel>
        <div className="mt-6 grid flex-1 grid-cols-3 gap-4">
          {items.map((item, i) => (
            <MovableCard
              key={i}
              ck={`item-${i}`}
              className="group relative flex flex-col justify-end overflow-hidden rounded-lg border border-white/[0.08] p-5 transition-colors hover:border-[var(--slide-accent,#22d3ee)]/30"
              style={
                item.imageUrl
                  ? undefined
                  : { background: `linear-gradient(165deg, rgba(255,255,255,0.04) 0%, rgba(0,0,0,0.4) 100%)` }
              }
            >
              <CardControls
                onDuplicate={() => duplicate(i)}
                onDelete={() => remove(i)}
                onSetImage={(url) => setImage(i, url)}
              />
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
              <div className="relative mb-2 flex items-center gap-2 text-[var(--slide-accent,#22d3ee)]">
                <SlideIcon name={iconForLabel(item.title)} size={18} />
                <span className="text-[10px] font-bold">0{i + 1}</span>
              </div>
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
            </MovableCard>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
