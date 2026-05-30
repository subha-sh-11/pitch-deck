"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { getProjectById } from "@/lib/mock/mock-projects";
import { projectRoutes } from "@/lib/routes";
import { SetupProgressBar } from "./SetupProgressBar";
import { SetupWizardProvider } from "./SetupWizardContext";

interface SetupWizardLayoutProps {
  projectId: string;
  children: ReactNode;
}

export function SetupWizardLayout({ projectId, children }: SetupWizardLayoutProps) {
  const project = getProjectById(projectId);

  return (
    <SetupWizardProvider projectId={projectId}>
      <div className="min-h-screen bg-surface-0 cinematic-gradient">
        <header className="border-b border-border-glass bg-surface-0/60 backdrop-blur-xl">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
            <div>
              <Link
                href={projectRoutes.dashboard()}
                className="text-xs text-text-dim hover:text-text-muted"
              >
                ← Dashboard
              </Link>
              <p className="mt-1 font-display text-lg font-semibold text-text-primary">
                {project.title}
              </p>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-6 py-10">
          <SetupProgressBar />
          {children}
        </main>
      </div>
    </SetupWizardProvider>
  );
}
