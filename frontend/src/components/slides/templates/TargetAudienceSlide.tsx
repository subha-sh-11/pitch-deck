import type { SlideContent } from "@/types/slide";
import { EditableText } from "../editing/EditableText";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";

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
          content.imageUrl ? "bg-black/65" : "bg-gradient-to-br from-[#0c0c0e] to-[#101010]"
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
                <EditableText
                  k={`item-${i}-title`}
                  as="h3"
                  className="text-sm font-semibold"
                  style={{ color: "var(--slide-accent)" }}
                  value={item.title}
                />
                {item.description && (
                  <EditableText
                    k={`item-${i}-desc`}
                    as="p"
                    multiline
                    className="mt-2 whitespace-pre-line text-xs leading-relaxed text-[#9CA3AF]"
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
              className="mt-6 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-[#C9CDD3]"
              value={content.body}
            />
          )
        )}
      </div>
    </SlideFrame>
  );
}
