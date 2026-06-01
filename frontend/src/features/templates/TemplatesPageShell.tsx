"use client";

import type { ReactNode } from "react";
import { SetupWizardProvider } from "@/features/setup/SetupWizardContext";

interface TemplatesPageShellProps {
  projectId: string;
  children: ReactNode;
}

export function TemplatesPageShell({ projectId, children }: TemplatesPageShellProps) {
  return (
    <SetupWizardProvider projectId={projectId}>
      <div className="min-h-screen bg-[#09090b]">
        <main className="mx-auto w-full max-w-7xl px-5 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </SetupWizardProvider>
  );
}
