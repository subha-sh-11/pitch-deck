import type { SlideContent } from "@/types/slide";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";

interface MarketPotentialSlideProps {
  content: SlideContent;
}

export function MarketPotentialSlide({ content }: MarketPotentialSlideProps) {
  const items =
    content.items ??
    content.bullets?.map((b) => ({ title: b, description: "" })) ??
    [];

  return (
    <SlideFrame imageUrl={content.imageUrl}>
      <div
        className={`absolute inset-0 ${content.imageUrl ? "bg-black/65" : "bg-[#0a0a0c]"}`}
      />
      <div className="relative flex h-full flex-col p-[7%]">
        <SlideLabel>{content.heading || "Market Potential"}</SlideLabel>
        {items.length > 0 ? (
          <div className="mt-6 grid flex-1 grid-cols-2 gap-4">
            {items.map((item) => (
              <div
                key={item.title}
                className="flex flex-col justify-between rounded-lg border border-white/[0.08] bg-white/[0.02] p-5"
              >
                <div className="mb-3 h-1 w-8" style={{ background: "var(--slide-accent)" }} />
                <h3 className="font-display text-lg font-semibold text-[#F5F1E8]">
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
