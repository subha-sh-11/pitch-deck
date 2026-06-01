"use client";

import type { ReactNode } from "react";
import { SetupWizardProvider } from "@/features/setup/SetupWizardContext";

interface PreviewPageShellProps {
  projectId: string;
  children: ReactNode;
}

export function PreviewPageShell({ projectId, children }: PreviewPageShellProps) {
  return (
    <SetupWizardProvider projectId={projectId}>
      <div className="preview-page flex h-screen flex-col overflow-hidden bg-[#050505]">
        <main className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col overflow-hidden px-4 py-4 sm:px-6 sm:py-5 lg:px-8 xl:max-w-[1600px]">
          {children}
        </main>
      </div>
    </SetupWizardProvider>
  );
}
