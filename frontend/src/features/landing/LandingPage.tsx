import Link from "next/link";
import { HeroSection } from "@/features/landing/HeroSection";
import { projectRoutes } from "@/lib/routes";

const features = [
  {
    title: "Script-aware intake",
    description:
      "Upload your screenplay and extract logline, genre, characters, and visual mood automatically.",
    icon: "◈",
  },
  {
    title: "Cinematic templates",
    description:
      "Investor, OTT, and festival decks with 12+ slides — cover, logline, USP, show cross, and more.",
    icon: "▣",
  },
  {
    title: "Pitch.com-style editor",
    description:
      "Glass UI, slide navigator, and one-click generate when your content is ready.",
    icon: "◇",
  },
];

const workflowSteps = [
  { step: "01", label: "Story setup", detail: "Identity, body, pitch" },
  { step: "02", label: "Pick template", detail: "AI-matched decks" },
  { step: "03", label: "Review content", detail: "Reliability check" },
  { step: "04", label: "Generate", detail: "Lock & build" },
  { step: "05", label: "Edit & export", detail: "Present & share" },
];

export function LandingPage() {
  return (
    <>
      <HeroSection />

      <section className="relative border-t border-white/[0.04] py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-neon/90">
              Why filmmakers switch
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold text-text-primary md:text-4xl">
              Generic tools don&apos;t speak cinema
            </h2>
            <p className="mt-4 text-base leading-relaxed text-text-muted">
              PowerPoint wasn&apos;t built for survival thrillers, OTT decks, or
              investor psychology. We were.
            </p>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="landing-feature-card landing-glass rounded-2xl p-8"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-neon/10 text-lg text-accent-neon">
                  {f.icon}
                </span>
                <h3 className="mt-5 font-display text-xl font-semibold text-text-primary">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative border-t border-white/[0.04] py-24 lg:py-28">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-lime/90">
              The workflow
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold text-text-primary md:text-4xl">
              From story to screen-ready deck
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-text-dim">
              Not prompt → random slides. A guided cinematic pipeline.
            </p>
          </div>

          <div className="landing-glass-strong relative overflow-hidden rounded-3xl p-8 md:p-10">
            <div className="landing-workflow-line absolute left-8 right-8 top-[4.5rem] hidden h-px md:block" />

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
              {workflowSteps.map((item, i) => (
                <div
                  key={item.step}
                  className="relative flex flex-col items-center text-center"
                >
                  <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border border-accent-neon/30 bg-accent-neon/10 font-display text-lg font-semibold text-accent-neon shadow-[0_0_24px_rgba(34,211,238,0.15)]">
                    {item.step}
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-text-primary">
                    {item.label}
                  </h3>
                  <p className="mt-1 text-xs text-text-dim">{item.detail}</p>
                  {i < workflowSteps.length - 1 && (
                    <span className="absolute -right-3 top-7 hidden text-accent-neon/40 lg:inline">
                      →
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative py-24 lg:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="landing-glass-strong relative overflow-hidden rounded-[2rem] px-8 py-14 text-center md:px-16 md:py-20">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.1)_0%,transparent_65%)]"
              aria-hidden
            />

            <h2 className="relative font-display text-3xl font-semibold text-text-primary md:text-4xl">
              Ready to pitch your next film?
            </h2>
            <p className="relative mx-auto mt-4 max-w-md text-base text-text-muted">
              Start with story intake. End with a producer-ready deck your investors
              will remember.
            </p>
            <div className="relative mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href={projectRoutes.newProject()}
                className="landing-btn-primary inline-flex rounded-xl px-8 py-3.5 text-sm font-semibold text-zinc-950"
              >
                Get started free
              </Link>
              <Link
                href={projectRoutes.setupIdentity("mock-project")}
                className="landing-btn-glass inline-flex rounded-xl px-8 py-3.5 text-sm font-medium text-text-primary"
              >
                Explore demo project
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.04] py-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 text-xs text-text-dim">
          <span className="font-display text-sm text-text-muted">
            Pitch Deck Studio
          </span>
          <span>© {new Date().getFullYear()} · Built for filmmakers</span>
        </div>
      </footer>
    </>
  );
}
