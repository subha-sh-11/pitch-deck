import type { SlideContent } from "@/types/slide";

interface SlideTemplateProps {
  content: SlideContent;
}

export function CoverSlide({ content }: SlideTemplateProps) {
  return (
    <div className="relative flex h-full flex-col justify-end overflow-hidden rounded-xl slide-canvas-bg p-8 md:p-12">
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />
      <div className="absolute right-0 top-0 h-1/2 w-1/2 bg-gradient-to-bl from-accent-gold/10 to-transparent" />
      <div className="relative">
        <h2 className="font-display text-4xl font-bold tracking-tight text-text-primary md:text-6xl">
          {content.heading}
        </h2>
        {content.subheading && (
          <p className="mt-2 text-lg text-accent-gold md:text-xl">{content.subheading}</p>
        )}
        {content.body && (
          <p className="mt-4 max-w-xl text-sm text-text-muted md:text-base">{content.body}</p>
        )}
      </div>
    </div>
  );
}

export function LoglineSlide({ content }: SlideTemplateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl slide-canvas-bg p-8 text-center md:p-12">
      <p className="mb-4 text-xs uppercase tracking-widest text-accent-gold">{content.heading}</p>
      <p className="font-display max-w-3xl text-2xl font-medium leading-relaxed text-text-primary md:text-3xl">
        {content.body}
      </p>
    </div>
  );
}

export function GenreBlendSlide({ content }: SlideTemplateProps) {
  return (
    <div className="flex h-full flex-col rounded-xl slide-canvas-bg p-6 md:p-10">
      <h2 className="mb-6 font-display text-2xl font-semibold text-text-primary">{content.heading}</h2>
      <div className="grid flex-1 gap-4 md:grid-cols-3">
        {content.items?.map((item) => (
          <div
            key={item.title}
            className="glass-panel flex flex-col justify-center rounded-xl p-4"
          >
            <h3 className="font-semibold text-accent-gold">{item.title}</h3>
            <p className="mt-2 text-sm text-text-muted">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SynopsisSlide({ content }: SlideTemplateProps) {
  return (
    <div className="grid h-full grid-cols-1 gap-4 rounded-xl slide-canvas-bg p-6 md:grid-cols-2 md:p-10">
      <div className="flex flex-col justify-center">
        <h2 className="mb-4 font-display text-2xl font-semibold text-text-primary">{content.heading}</h2>
        <p className="text-sm leading-relaxed text-text-muted md:text-base">{content.body}</p>
      </div>
      <div className="rounded-xl bg-gradient-to-br from-surface-3 via-accent-rust/20 to-surface-0 min-h-[120px]" />
    </div>
  );
}

export function StoryWorldSlide({ content }: SlideTemplateProps) {
  return (
    <div className="relative flex h-full flex-col justify-end overflow-hidden rounded-xl slide-canvas-bg p-8 md:p-10">
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 to-transparent" />
      <div className="relative max-w-lg">
        <h2 className="font-display text-2xl font-semibold text-text-primary">{content.heading}</h2>
        <p className="mt-3 text-sm leading-relaxed text-text-muted md:text-base">{content.body}</p>
      </div>
    </div>
  );
}

export function CharacterSlide({ content }: SlideTemplateProps) {
  return (
    <div className="flex h-full flex-col rounded-xl slide-canvas-bg p-6 md:p-10">
      <h2 className="mb-6 font-display text-2xl font-semibold text-text-primary">{content.heading}</h2>
      <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {content.characters?.map((char) => (
          <div key={char.name} className="glass-panel rounded-xl p-4">
            <div className="mb-3 h-16 w-16 rounded-full bg-gradient-to-br from-accent-rust/40 to-surface-3" />
            <h3 className="font-semibold text-text-primary">{char.name}</h3>
            <p className="text-xs text-accent-gold">{char.role}</p>
            <p className="mt-2 text-xs text-text-muted">{char.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function USPGridSlide({ content }: SlideTemplateProps) {
  return (
    <div className="flex h-full flex-col rounded-xl slide-canvas-bg p-6 md:p-10">
      <h2 className="mb-6 font-display text-2xl font-semibold text-text-primary">{content.heading}</h2>
      <div className="grid flex-1 gap-3 sm:grid-cols-2">
        {content.bullets?.map((bullet) => (
          <div
            key={bullet}
            className="flex items-start gap-3 rounded-xl border border-border-glass bg-surface-2/50 p-4"
          >
            <span className="text-accent-gold">◆</span>
            <p className="text-sm text-text-primary">{bullet}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ShowCrossSlide({ content }: SlideTemplateProps) {
  return (
    <div className="flex h-full flex-col rounded-xl slide-canvas-bg p-6 md:p-10">
      <h2 className="mb-6 font-display text-2xl font-semibold text-text-primary">{content.heading}</h2>
      <div className="grid flex-1 gap-4 md:grid-cols-3">
        {content.comps?.map((comp) => (
          <div key={comp.title} className="glass-panel rounded-xl overflow-hidden">
            <div className="aspect-[2/3] bg-gradient-to-b from-surface-3 to-surface-0" />
            <div className="p-4">
              <h3 className="font-semibold text-text-primary">{comp.title}</h3>
              <p className="mt-1 text-xs text-text-muted">{comp.note}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function VisualAestheticSlide({ content }: SlideTemplateProps) {
  return (
    <div className="flex h-full flex-col rounded-xl slide-canvas-bg p-6 md:p-10">
      <h2 className="mb-4 font-display text-2xl font-semibold text-text-primary">{content.heading}</h2>
      <p className="mb-6 text-sm text-text-muted">{content.body}</p>
      <div className="grid flex-1 grid-cols-2 gap-3 md:grid-cols-4">
        {content.moodBlocks?.map((block) => (
          <div
            key={block.label}
            className="flex flex-col justify-end rounded-xl p-3 min-h-[80px]"
            style={{ backgroundColor: block.color }}
          >
            <span className="text-xs font-medium text-white/90">{block.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TargetAudienceSlide({ content }: SlideTemplateProps) {
  return (
    <div className="flex h-full flex-col rounded-xl slide-canvas-bg p-6 md:p-10">
      <h2 className="mb-6 font-display text-2xl font-semibold text-text-primary">{content.heading}</h2>
      <div className="grid flex-1 gap-4 md:grid-cols-3">
        {content.items?.map((item) => (
          <div key={item.title} className="glass-panel rounded-xl p-4">
            <h3 className="text-sm font-semibold text-accent-gold">{item.title}</h3>
            <p className="mt-2 text-sm text-text-muted">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ContactSlide({ content }: SlideTemplateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl slide-canvas-bg p-8 text-center">
      <h2 className="font-display text-3xl font-semibold text-text-primary">{content.heading}</h2>
      {content.subheading && (
        <p className="mt-2 text-accent-gold">{content.subheading}</p>
      )}
      {content.body && (
        <p className="mt-4 text-sm text-text-muted">{content.body}</p>
      )}
    </div>
  );
}

export function GenericSlide({ content }: SlideTemplateProps) {
  return (
    <div className="flex h-full flex-col rounded-xl slide-canvas-bg p-6 md:p-10">
      <h2 className="mb-4 font-display text-2xl font-semibold text-text-primary">{content.heading}</h2>
      {content.body && (
        <p className="text-sm leading-relaxed text-text-muted md:text-base">{content.body}</p>
      )}
      {content.bullets && (
        <ul className="mt-4 space-y-2">
          {content.bullets.map((b) => (
            <li key={b} className="flex gap-2 text-sm text-text-muted">
              <span className="text-accent-gold">—</span>
              {b}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
