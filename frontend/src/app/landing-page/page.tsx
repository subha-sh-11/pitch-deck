"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";

const HERO_IMAGES = ["/hero.png", "/hero2.png", "/hero3.png"];
const SLIDE_INTERVAL = 5000;

/** Renders text as per-letter spans so it can animate letter-by-letter. */
function AnimatedText({ text }: { text: string }) {
  return (
    <>
      {text.split("").map((char, i) => (
        <span
          key={i}
          className={styles.char}
          style={{ animationDelay: `${i * 0.05}s` }}
        >
          {char === " " ? " " : char}
        </span>
      ))}
    </>
  );
}

export default function LandingPage() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActive((prev) => (prev + 1) % HERO_IMAGES.length);
    }, SLIDE_INTERVAL);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.frame}>
        {/* -------- Navigation -------- */}
        <header className={styles.nav}>
          <nav className={styles.navGroup}>
            <button type="button" className={styles.navLink}>
              <AnimatedText text="Home" />
            </button>
            <button type="button" className={styles.navLink}>
              <AnimatedText text="About" />
            </button>
            <button type="button" className={styles.navLink}>
              <AnimatedText text="Service" />
            </button>
          </nav>

          <div className={styles.logo}>
            Pitch<span>-</span>deck<span>.</span>
          </div>

          <nav className={styles.navGroup}>
            <button type="button" className={styles.navLink}>
              <AnimatedText text="Work" />
            </button>
            <button type="button" className={styles.navLink}>
              <AnimatedText text="Contact" />
            </button>
          </nav>
        </header>

        {/* -------- Hero -------- */}
        <section className={styles.hero}>
          {/* cross-fading background slides */}
          {HERO_IMAGES.map((src, i) => (
            <div
              key={src}
              className={`${styles.heroSlide} ${i === active ? styles.active : ""}`}
              style={{ backgroundImage: `url("${src}")` }}
            />
          ))}

          <div className={styles.heroContent}>
            <h1 className={styles.headline}>
              <span className={styles.headlineTop}>We&rsquo;re Creative</span>
              <span className={styles.headlineScript} aria-label="pitches">
                {"pitches".split("").map((char, i) => (
                  <span
                    key={i}
                    aria-hidden="true"
                    className={styles.letter}
                    style={{ animationDelay: `${i * 0.12}s` }}
                  >
                    {char}
                  </span>
                ))}
              </span>
            </h1>

            <div className={styles.bottom}>
              <div className={styles.pitch}>
                <p className={styles.pitchText}>
                  We build brands with clarity and courage designed to stand
                  out, inspire trust, and fuel growth. Build brands that are
                  meaningful, memorable market-ready.
                </p>
                <button type="button" className={styles.cta}>
                  Start Your Project
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M5 12h14M13 6l6 6-6 6"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>

              <aside className={styles.aside}>
                <span className={styles.asideLabel}>// Built to lead forward.</span>

                {/* mini preview of the slide currently on screen */}
                <div className={styles.thumb}>
                  {HERO_IMAGES.map((src, i) => (
                    <div
                      key={src}
                      className={`${styles.thumbSlide} ${
                        i === active ? styles.active : ""
                      }`}
                      style={{ backgroundImage: `url("${src}")` }}
                    />
                  ))}
                </div>

                <div className={styles.progress}>
                  {HERO_IMAGES.map((src, i) => (
                    <button
                      key={src}
                      type="button"
                      aria-label={`Show slide ${i + 1}`}
                      onClick={() => setActive(i)}
                      className={`${styles.progressBar} ${
                        i === active ? styles.active : ""
                      }`}
                    />
                  ))}
                </div>
              </aside>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
