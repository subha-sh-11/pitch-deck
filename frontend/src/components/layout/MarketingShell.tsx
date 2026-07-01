import Link from "next/link";
import type { ReactNode } from "react";
import { LandingBackground } from "@/features/landing/LandingBackground";
import { projectRoutes } from "@/lib/routes";
import { AuthNav } from "./AuthNav";

interface MarketingShellProps {
  children: ReactNode;
}

export function MarketingShell({ children }: MarketingShellProps) {
  return (
    <div className="landing-page min-h-screen bg-surface-0">
      <LandingBackground />

      <header className="landing-glass-nav sticky top-0 z-50">
        <div className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg landing-glass text-sm font-bold text-accent-neon neon-glow-sm">
              P
            </span>
            <span className="font-display text-lg font-semibold tracking-wide text-text-primary transition-colors group-hover:text-accent-neon">
              Pitch Deck Studio
            </span>
          </Link>
          <nav className="flex items-center gap-3">
            <Link
              href={projectRoutes.dashboard()}
              className="hidden rounded-lg px-3 py-2 text-sm text-text-muted transition-colors hover:bg-white/[0.05] hover:text-text-primary sm:block"
            >
              Dashboard
            </Link>
            <Link
              href={projectRoutes.newProject()}
              className="rounded-xl border border-border-glass bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-text-primary transition-colors hover:border-accent-neon/40 hover:bg-white/[0.07]"
            >
              New Project
            </Link>
            <AuthNav />
          </nav>
        </div>
      </header>

      <main className="relative z-10">{children}</main>
    </div>
  );
}
