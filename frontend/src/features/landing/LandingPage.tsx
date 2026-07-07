import { HeroSection } from "@/features/landing/HeroSection";
import { LandingBackground } from "@/features/landing/LandingBackground";

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
    <div className="landing-page landing-home min-h-screen bg-surface-0">
      <HeroSection />

      {/* Sections below the hero keep the original ambient background. */}
      <div className="relative">
        <LandingBackground />
        <div className="relative z-10">
      <section id="features" className="relative border-t border-white/[0.04] py-24 lg:py-32">
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

      <section id="how-it-works" className="relative border-t border-white/[0.04] py-24 lg:py-28">
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

          <div className="workflow-panel">
            <ol className="workflow-flow">
              {workflowSteps.map((item, i) => (
                <li key={item.step} className="workflow-step">
                  <span className="workflow-node">{item.step}</span>
                  {i < workflowSteps.length - 1 && (
                    <span className="workflow-connector" aria-hidden>
                      <span className="wf-line" />
                      <svg
                        className="wf-arrow"
                        width="17"
                        height="12"
                        viewBox="0 0 17 12"
                        fill="none"
                        aria-hidden
                      >
                        <path
                          d="M0 6h14M11 1.5 15.5 6 11 10.5"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  )}
                  <h3 className="workflow-step-title">{item.label}</h3>
                  <p className="workflow-step-detail">{item.detail}</p>
                </li>
              ))}
            </ol>
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
        </div>
      </div>
    </div>
  );
}
