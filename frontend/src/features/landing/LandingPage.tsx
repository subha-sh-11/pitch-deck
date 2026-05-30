import { Button } from "@/components/ui/Button";
import { HeroSection } from "@/features/landing/HeroSection";
import { projectRoutes } from "@/lib/routes";

const workflowSteps = [
  "Intake",
  "Questions",
  "Story Analysis",
  "Outline",
  "Content",
  "Design",
  "Editor",
  "Review",
  "Export",
];

export function LandingPage() {
  return (
    <>
      <HeroSection />

      <section className="border-t border-border-glass py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="glass-panel mx-auto max-w-3xl rounded-2xl p-8 text-center md:p-10">
            <h2 className="font-display text-2xl font-semibold text-text-primary md:text-3xl">
              Generic tools don&apos;t understand cinema
            </h2>
            <p className="mt-4 text-base leading-relaxed text-text-muted">
              Film pitch decks demand storytelling skill, design sense, and
              industry knowledge. PowerPoint and Canva were never built for
              directors, OTT pitching, cinematic mood, or investor psychology.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-border-glass bg-surface-1/30 py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-8 text-center">
            <p className="text-xs uppercase tracking-[0.15em] text-accent-gold">
              The workflow
            </p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-text-primary md:text-3xl">
              Creative intake to export — not prompt to deck
            </h2>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin md:justify-center md:flex-wrap md:overflow-visible">
            {workflowSteps.map((step, i) => (
              <div
                key={step}
                className="flex shrink-0 items-center gap-2 rounded-full border border-border-glass bg-surface-2/60 px-4 py-2 backdrop-blur-sm"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-gold/15 text-[10px] font-medium text-accent-gold">
                  {i + 1}
                </span>
                <span className="whitespace-nowrap text-sm text-text-primary">
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border-glass py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="cta-glow-border mx-auto max-w-2xl rounded-2xl p-10 text-center">
            <h2 className="font-display text-2xl font-semibold text-text-primary md:text-3xl">
              Build your cinematic pitch deck workflow
            </h2>
            <p className="mt-3 text-sm text-text-muted">
              Start with story intake. End with a producer-ready deck.
            </p>
            <div className="mt-8">
              <Button href={projectRoutes.newProject()} size="lg">
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
