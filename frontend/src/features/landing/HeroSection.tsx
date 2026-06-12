import Link from "next/link";
import { DeckPreviewPanel } from "@/features/landing/DeckPreviewPanel";
import { projectRoutes } from "@/lib/routes";

export function HeroSection() {
  return (
    <section className="relative min-h-[92vh] overflow-hidden">
      <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-14 px-6 pb-20 pt-16 lg:flex-row lg:items-center lg:gap-12 lg:pb-28 lg:pt-20">
        <div className="flex-1 text-center lg:max-w-xl lg:text-left">
          <h1 className="landing-animate-in landing-delay-2 font-display text-[clamp(2.5rem,6vw,4.25rem)] font-semibold leading-[1.05] tracking-tight text-text-primary">
            AI Pitch Deck Studio for{" "}
            <span className="landing-text-shimmer">Filmmakers</span>
          </h1>

          <p className="landing-animate-in landing-delay-3 mx-auto mt-6 max-w-lg text-lg leading-relaxed text-text-muted lg:mx-0">
            Turn scripts, director vision, and story DNA into cinematic,
            investor-ready decks — in minutes, not weeks.
          </p>

          <p className="landing-animate-in landing-delay-3 mx-auto mt-3 max-w-md text-sm text-text-dim lg:mx-0">
            Built for feature films, OTT pitches, and producer meetings. Not a
            generic slide tool.
          </p>

          <div className="landing-animate-in landing-delay-4 mt-10 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
            <Link
              href={projectRoutes.newProject()}
              className="landing-btn-primary inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-semibold text-zinc-950"
            >
              Create New Pitch Deck
              <span aria-hidden>→</span>
            </Link>
            <Link
              href={projectRoutes.dashboard()}
              className="landing-btn-glass inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-medium text-text-primary"
            >
              View Projects
            </Link>
          </div>

          <div className="landing-animate-in landing-delay-5 mt-12 flex flex-wrap items-center justify-center gap-8 lg:justify-start">
            {[
              { value: "12+", label: "Slide templates", accent: "text-accent-neon" },
              { value: "AI", label: "Story extraction", accent: "text-accent-lime" },
              { value: "1-click", label: "Export ready", accent: "text-text-primary" },
            ].map((stat) => (
              <div key={stat.label} className="text-center lg:text-left">
                <p className={`font-display text-2xl font-semibold ${stat.accent}`}>
                  {stat.value}
                </p>
                <p className="text-[11px] uppercase tracking-wider text-text-dim">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="landing-animate-in landing-delay-6 w-full flex-1 lg:max-w-[540px]">
          <DeckPreviewPanel />
        </div>
      </div>
    </section>
  );
}
