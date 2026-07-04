import { HeroHeader } from "@/features/landing/hero/HeroHeader";
import { HeroContent } from "@/features/landing/hero/HeroContent";
import { CinematicGallery } from "@/features/landing/hero/CinematicGallery";
import { PartnerStrip } from "@/features/landing/hero/PartnerStrip";

/**
 * Cinematic, cinema-first hero: a near-black full-screen stage with a restrained
 * red glow behind the nav and headline, an editorial serif headline, two CTAs,
 * a five-card cinematic gallery dissolving into darkness, and a trust strip.
 */
export function HeroSection() {
  return (
    <section className="hero-root">
      {/* Decorative background layers */}
      <div className="hero-bg" aria-hidden>
        <div className="hero-bg-glow" />
        <div className="hero-bg-grain" />
        <div className="hero-bg-vignette" />
      </div>

      <div className="hero-shell">
        <HeroHeader />

        <main className="hero-main">
          <HeroContent />
          <CinematicGallery />
        </main>

        <PartnerStrip />
      </div>
    </section>
  );
}
