import type { SlideContent } from "@/types/slide";
import { CardControls } from "../editing/CardControls";
import { EditableText } from "../editing/EditableText";
import { MovableCard } from "../editing/MovableCard";
import { useSlideEdit } from "../editing/SlideEditContext";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";
import { SlideIcon, iconForLabel } from "../shared/SlideIcon";

interface MarketPotentialSlideProps {
  content: SlideContent;
}

export function MarketPotentialSlide({ content }: MarketPotentialSlideProps) {
  const items =
    content.items ??
    content.bullets?.map((b) => ({ title: b, description: "" })) ??
    [];
  const { patchContent } = useSlideEdit();
  const duplicate = (i: number) => patchContent({ items: [...items, { ...items[i] }] });
  const remove = (i: number) => patchContent({ items: items.filter((_, j) => j !== i) });

  return (
    <SlideFrame imageUrl={content.imageUrl}>
      <div
        className={`absolute inset-0 ${content.imageUrl ? "bg-black/65" : ""}`}
        style={
          content.imageUrl
            ? undefined
            : { background: "var(--slide-ground, var(--slide-bg, #0a0a0c))" }
        }
      />
      <div className="relative flex h-full flex-col p-[calc(7%_+_var(--slide-pad-delta,0%))]">
        <SlideLabel>
          <EditableText k="heading" as="span" value={content.heading || "Market Potential"} />
        </SlideLabel>
        {items.length > 0 ? (
          <div className="mt-6 grid flex-1 grid-cols-2 gap-4">
            {items.map((item, i) => (
              <MovableCard
                key={i}
                ck={`item-${i}`}
                className="group relative flex flex-col justify-between rounded-lg border border-white/[0.08] bg-white/[0.02] p-5"
              >
                <CardControls onDuplicate={() => duplicate(i)} onDelete={() => remove(i)} />
                <SlideIcon
                  name={iconForLabel(item.title, "market")}
                  size={20}
                  className="mb-3 text-[var(--slide-accent,#22d3ee)]"
                />
                <EditableText
                  k={`item-${i}-title`}
                  as="h3"
                  className="font-display text-lg font-semibold text-[var(--slide-text,#F5F1E8)]"
                  value={item.title}
                />
                {item.description && (
                  <EditableText
                    k={`item-${i}-desc`}
                    as="p"
                    multiline
                    className="mt-2 whitespace-pre-line text-xs leading-relaxed text-[var(--slide-text-muted,#9CA3AF)]"
                    value={item.description}
                  />
                )}
              </MovableCard>
            ))}
          </div>
        ) : (
          content.body && (
            <EditableText
              k="body"
              as="p"
              multiline
              className="mt-6 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-[var(--slide-text-muted,#C9CDD3)]"
              value={content.body}
            />
          )
        )}
      </div>
    </SlideFrame>
  );
}
