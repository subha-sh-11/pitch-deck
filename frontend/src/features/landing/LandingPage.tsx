import { HeroSection } from "@/features/landing/HeroSection";

/** The marketing home is a single, non-scrolling viewport: just the hero. */
export function LandingPage() {
  return (
    <div className="landing-page landing-home">
      <HeroSection />
    </div>
  );
}
