import type { SlideContent } from "@/types/slide";
import { CardControls } from "../editing/CardControls";
import { EditableText } from "../editing/EditableText";
import { MovableCard } from "../editing/MovableCard";
import { useSlideEdit } from "../editing/SlideEditContext";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";
import { SlideIcon, iconForLabel } from "../shared/SlideIcon";

interface TargetAudienceSlideProps {
  content: SlideContent;
}

export function TargetAudienceSlide({ content }: TargetAudienceSlideProps) {
  const items =
    content.items ?? content.bullets?.map((b) => ({ title: b, description: "" })) ?? [];
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
          <EditableText k="heading" as="span" value={content.heading || "Target Audience"} />
        </SlideLabel>
        {/* Supporting paragraph: shown when the agent/user adds prose to `body`, so added
            content is never silently swallowed by the items grid. */}
        {content.body && (
          <EditableText
            k="body"
            as="p"
            multiline
            className="mt-4 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-[var(--slide-text-muted,#C9CDD3)]"
            value={content.body}
          />
        )}
        {items.length > 0 ? (
          <div className="mt-6 grid flex-1 grid-cols-2 gap-3 content-start">
            {items.map((item, i) => (
              <MovableCard
                key={i}
                ck={`item-${i}`}
                className="group relative rounded-lg border p-4"
                style={{
                  borderColor: "color-mix(in srgb, var(--slide-accent) 20%, transparent)",
                  background: "color-mix(in srgb, var(--slide-accent) 6%, transparent)",
                }}
              >
                <CardControls onDuplicate={() => duplicate(i)} onDelete={() => remove(i)} />
                <div className="flex items-center gap-2" style={{ color: "var(--slide-accent)" }}>
                  <SlideIcon name={iconForLabel(item.title, "audience")} size={18} />
                  <EditableText
                    k={`item-${i}-title`}
                    as="h3"
                    className="text-sm font-semibold"
                    value={item.title}
                  />
                </div>
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
        ) : null}
      </div>
    </SlideFrame>
  );
}
