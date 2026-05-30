import Link from "next/link";
import type { ReactNode } from "react";

interface MarketingShellProps {
  children: ReactNode;
}

export function MarketingShell({ children }: MarketingShellProps) {
  return (
    <div className="min-h-screen bg-surface-0 cinematic-gradient">
      <header className="sticky top-0 z-50 border-b border-border-glass bg-surface-0/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="group flex items-center gap-2">
            <span className="font-display text-xl font-semibold text-text-primary">
              Pitch Deck Studio
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-accent-gold opacity-80 group-hover:opacity-100" />
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-sm text-text-muted transition-colors hover:text-text-primary"
            >
              Dashboard
            </Link>
            <Link
              href="/projects/new"
              className="rounded-xl bg-accent-gold px-4 py-2 text-sm font-medium text-surface-0 transition-colors hover:bg-accent-gold-dim"
            >
              New Project
            </Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
