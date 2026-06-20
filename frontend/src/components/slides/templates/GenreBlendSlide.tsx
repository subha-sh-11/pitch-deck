import type { SlideContent } from "@/types/slide";
import { EditableText } from "../editing/EditableText";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";

interface GenreBlendSlideProps {
  content: SlideContent;
}

/**
 * Editorial "genre fusion" layout — a left-weighted, numbered vertical list with bold
 * display titles and accent rules, over a directional scrim so it stays legible on any image.
 */
export function GenreBlendSlide({ content }: GenreBlendSlideProps) {
  const items = content.items ?? [];

  return (
    <SlideFrame imageUrl={content.imageUrl}>
      {/* Directional scrim: dark where the text lives, opening up toward the image. */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/88 via-black/55 to-black/15" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />

      <div className="relative flex h-full flex-col justify-center p-[7%]">
        <SlideLabel>
          <EditableText k="heading" as="span" value={content.heading || "Genre Blend"} />
        </SlideLabel>

        <div className="mt-7 flex max-w-[64%] flex-col gap-5">
          {items.map((item, i) => (
            <div key={i} className="flex items-start gap-4">
              <span
                className="font-display text-4xl font-bold leading-none"
                style={{ color: "var(--slide-accent)" }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div
                className="border-l-2 pl-4"
                style={{ borderColor: "color-mix(in srgb, var(--slide-accent) 55%, transparent)" }}
              >
                <EditableText
                  k={`item-${i}-title`}
                  as="h3"
                  className="font-display text-[clamp(1.25rem,2.4vw,2rem)] font-semibold leading-tight text-[#F5F1E8]"
                  value={item.title}
                />
                <EditableText
                  k={`item-${i}-desc`}
                  as="p"
                  multiline
                  className="mt-1.5 max-w-md whitespace-pre-line text-[clamp(0.7rem,1vw,0.9rem)] leading-relaxed text-[#C9CDD3]"
                  value={item.description}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
