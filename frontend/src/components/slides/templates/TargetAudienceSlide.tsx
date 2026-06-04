import type { SlideContent } from "@/types/slide";
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
        <SlideLabel>{content.heading || "Target Audience"}</SlideLabel>
        {items.length > 0 ? (
          <div className="mt-6 grid flex-1 grid-cols-2 gap-3 content-start">
            {items.map((item) => (
              <div
                key={item.title}
                className="rounded-lg border p-4"
                style={{
                  borderColor: "color-mix(in srgb, var(--slide-accent) 20%, transparent)",
                  background: "color-mix(in srgb, var(--slide-accent) 6%, transparent)",
                }}
              >
                <h3 className="text-sm font-semibold" style={{ color: "var(--slide-accent)" }}>
                  {item.title}
                </h3>
                {item.description && (
                  <p className="mt-2 text-xs leading-relaxed text-[#9CA3AF]">
                    {item.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          content.body && (
            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-[#C9CDD3]">
              {content.body}
            </p>
          )
        )}
      </div>
    </SlideFrame>
  );
}
