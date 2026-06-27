const palettes = [
  { name: "Concrete", color: "#3a3a3c" },
  { name: "Moss", color: "#2f4538" },
  { name: "Ivory", color: "#f4f1ec" },
  { name: "Water", color: "#aebfc6" },
];

const decks = [
  {
    title: "The Tank",
    meta: "Feature · Investor pitch",
    tag: "Survival Thriller",
    accent: "#9a4322",
  },
  {
    title: "Monsoon Lines",
    meta: "Series · OTT pitch",
    tag: "Suspense Drama",
    accent: "#2f4538",
  },
  {
    title: "Paper Boats",
    meta: "Feature · Festival",
    tag: "Childhood Comedy",
    accent: "#aebfc6",
  },
];

/**
 * Cinematic, on-brand collage shown on the right half of the sign-up screen.
 * Floating deck cards + a palette card echo the live-preview panel on the
 * landing page rather than borrowing generic app screenshots.
 */
export function AuthShowcase() {
  return (
    <div className="relative hidden h-full w-full overflow-hidden lg:block">
      {/* warm cinematic wash */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 70% 30%, rgba(248,201,164,0.16), transparent 60%), radial-gradient(ellipse 70% 60% at 30% 90%, rgba(154,67,34,0.18), transparent 65%)",
        }}
      />
      <div className="landing-grid absolute inset-0 opacity-60" aria-hidden />

      <div className="relative flex h-full flex-col justify-center gap-5 px-12 py-10 xl:px-16">
        <div className="max-w-md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-neon/90">
            Live preview
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-text-primary xl:text-3xl">
            Your story, rendered as a cinematic deck.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">
            Loglines, genre blends, and visual aesthetics — auto-built into
            producer-ready slides.
          </p>
        </div>

        {/* floating deck cards */}
        <div className="relative grid grid-cols-2 gap-3.5">
          {decks.map((deck, i) => (
            <div
              key={deck.title}
              className={`landing-glass landing-preview-float rounded-2xl p-4 ${
                i === 0 ? "col-span-2" : ""
              }`}
              style={{ animationDelay: `${i * 0.8}s` }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-text-primary"
                  style={{ background: `${deck.accent}33` }}
                >
                  {deck.tag}
                </span>
                <span className="font-display text-[11px] text-text-dim">
                  {`0${i + 1} / 16`}
                </span>
              </div>
              <h3 className="mt-3 font-display text-lg font-semibold text-text-primary">
                {deck.title}
              </h3>
              <p className="mt-0.5 text-xs text-text-dim">{deck.meta}</p>
              <div
                className="mt-3 h-1 w-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${deck.accent}, transparent)`,
                }}
              />
            </div>
          ))}

          {/* palette card */}
          <div
            className="landing-glass landing-preview-float col-span-2 rounded-2xl p-4"
            style={{ animationDelay: "1.4s" }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-neon/90">
              Visual aesthetic
            </p>
            <p className="mt-1.5 text-xs text-text-muted">
              Dark concrete, water reflections, claustrophobic framing.
            </p>
            <div className="mt-3 grid grid-cols-4 gap-2.5">
              {palettes.map((p) => (
                <div key={p.name} className="text-center">
                  <div
                    className="h-9 w-full rounded-lg border border-white/10"
                    style={{ background: p.color }}
                  />
                  <p className="mt-1.5 text-[10px] uppercase tracking-wider text-text-dim">
                    {p.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
