"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { getProject } from "@/lib/api";
import { projectRoutes } from "@/lib/routes";
import { SetupProgressBar } from "./SetupProgressBar";
import { SetupWizardProvider } from "./SetupWizardContext";

interface SetupWizardLayoutProps {
  projectId: string;
  children: ReactNode;
}

export function SetupWizardLayout({ projectId, children }: SetupWizardLayoutProps) {
  const [title, setTitle] = useState("Project");

  useEffect(() => {
    getProject(projectId)
      .then((p) => setTitle(p.title || "Project"))
      .catch(() => setTitle("Project"));
  }, [projectId]);

  return (
    <SetupWizardProvider projectId={projectId}>
      <div className="min-h-screen bg-surface-0 cinematic-gradient">
        <header className="border-b border-border-glass bg-surface-0/60 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4 lg:px-10">
            <div>
              <Link
                href={projectRoutes.dashboard()}
                className="text-xs text-text-dim hover:text-text-muted"
              >
                ← Dashboard
              </Link>
              <p className="mt-1 font-display text-lg font-semibold text-text-primary">
                {title}
              </p>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-10">
          <SetupProgressBar />
          {children}
        </main>
      </div>
    </SetupWizardProvider>
  );
}
