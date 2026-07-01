import type { SlideContent } from "@/types/slide";
import { EditableText } from "../editing/EditableText";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";
import { SlideIcon, iconForLabel } from "../shared/SlideIcon";

interface TargetAudienceSlideProps {
  content: SlideContent;
}

export function TargetAudienceSlide({ content }: TargetAudienceSlideProps) {
  const items =
    content.items ?? content.bullets?.map((b) => ({ title: b, description: "" })) ?? [];

  return (
    <SlideFrame imageUrl={content.imageUrl}>
      <div
        className={`absolute inset-0 ${
          content.imageUrl ? "bg-black/65" : "bg-[var(--slide-bg,#0a0a0c)]"
        }`}
      />
      <div className="relative flex h-full flex-col p-[7%]">
        <SlideLabel>
          <EditableText k="heading" as="span" value={content.heading || "Target Audience"} />
        </SlideLabel>
        {items.length > 0 ? (
          <div className="mt-6 grid flex-1 grid-cols-2 gap-3 content-start">
            {items.map((item, i) => (
              <div
                key={i}
                className="rounded-lg border p-4"
                style={{
                  borderColor: "color-mix(in srgb, var(--slide-accent) 20%, transparent)",
                  background: "color-mix(in srgb, var(--slide-accent) 6%, transparent)",
                }}
              >
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
              </div>
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
