"use client";

import type { ReactNode } from "react";
import { SetupWizardProvider } from "./SetupWizardContext";

interface SetupWizardLayoutProps {
  projectId: string;
  children: ReactNode;
}

// Full-bleed wrapper: provides the shared setup state. The intake studio renders
// its own edge-to-edge layout (chat + artifact), so no outer chrome here.
export function SetupWizardLayout({ projectId, children }: SetupWizardLayoutProps) {
  return <SetupWizardProvider projectId={projectId}>{children}</SetupWizardProvider>;
}
