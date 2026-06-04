"use client";

import { Badge } from "@/components/ui/Badge";

const TEMPLATE_ICONS: Record<string, string> = {
  "investor-thriller": "INV",
  "ott-streaming": "OTT",
  "festival-directors": "FST",
  "series-bible-lite": "SER",
  "documentary-realism": "DOC",
  "action-blockbuster": "ACT",
};

interface TemplatePreviewCardProps {
  template: { id: string; name: string; description: string; slideCount: number };
  selected: boolean;
  recommended?: boolean;
  onSelect: () => void;
}

export function TemplatePreviewCard({
  template,
  selected,
  recommended,
  onSelect,
}: TemplatePreviewCardProps) {
  const icon = TEMPLATE_ICONS[template.id] ?? "DK";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`template-card group w-full rounded-xl border text-left transition-all duration-200 ${
        selected
          ? "template-card--selected border-accent-neon/40 bg-zinc-900/90"
          : "border-zinc-800/80 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-900/70"
      }`}
    >
      <div className="flex gap-3 p-3.5">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-[10px] font-semibold tracking-wide ${
            selected
              ? "border-accent-neon/30 bg-accent-neon/10 text-accent-neon"
              : "border-zinc-700 bg-zinc-800/80 text-zinc-500"
          }`}
        >
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {recommended && (
              <Badge variant="neon" className="!px-1.5 !py-0 text-[10px]">
                Recommended
              </Badge>
            )}
            <span className="text-[10px] font-medium text-zinc-500">
              {template.slideCount} slides
            </span>
          </div>
          <h3
            className={`mt-1 font-display text-base font-semibold leading-tight ${
              selected ? "text-zinc-100" : "text-zinc-200"
            }`}
          >
            {template.name}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500">
            {template.description}
          </p>
        </div>

        <div
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
            selected
              ? "border-accent-neon"
              : "border-zinc-600 group-hover:border-zinc-500"
          }`}
          aria-hidden
        >
          {selected && (
            <span className="block h-2 w-2 rounded-full bg-accent-neon" />
          )}
        </div>
      </div>
    </button>
  );
}
