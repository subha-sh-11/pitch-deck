import { Button } from "@/components/ui/Button";
import { DeckPreviewPanel } from "@/features/landing/DeckPreviewPanel";
import { MOCK_PROJECT_ID } from "@/lib/mock/mock-projects";
import { projectRoutes } from "@/lib/routes";

export function HeroSection() {
  return (
    <section className="landing-spotlight landing-vignette landing-grain relative min-h-[90vh]">
      <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-12 px-6 py-24 lg:flex-row lg:items-center lg:gap-16 lg:py-32">
        <div className="flex-1 text-center lg:text-left">
          <p className="mb-5 text-xs font-medium uppercase tracking-[0.2em] text-accent-gold">
            Gamma for filmmakers
          </p>
          <h1 className="font-display text-4xl font-semibold leading-[1.05] text-text-primary sm:text-5xl md:text-6xl lg:text-7xl">
            AI Pitch Deck Studio for{" "}
            <span className="text-gradient-gold">Filmmakers</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-text-muted md:text-xl lg:mx-0">
            Turn film ideas, scripts, and director vision into cinematic
            investor-ready pitch decks.
          </p>
          <p className="mx-auto mt-4 max-w-lg text-sm text-text-dim lg:mx-0">
            Purpose-built for film, web series, OTT, studio, producer, and
            investor pitches — not another generic presentation tool.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
            <Button href={projectRoutes.newProject()} size="lg">
              Create New Pitch Deck
            </Button>
            <Button
              href={projectRoutes.setupIdentity(MOCK_PROJECT_ID)}
              variant="secondary"
              size="lg"
            >
              View Demo Workspace
            </Button>
          </div>
        </div>

        <div className="w-full flex-1 lg:max-w-xl">
          <DeckPreviewPanel />
        </div>
      </div>
    </section>
  );
}
