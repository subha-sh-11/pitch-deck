"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { projectRoutes } from "@/lib/routes";
import { getProjectById } from "@/lib/mock/mock-projects";
import { getPhaseLabel, getStepFromPathname } from "@/lib/workflow";
import { PROJECT_TYPE_LABELS } from "@/types/project";

interface WorkspaceTopbarProps {
  projectId: string;
}

export function WorkspaceTopbar({ projectId }: WorkspaceTopbarProps) {
  const pathname = usePathname();
  const project = getProjectById(projectId);
  const activeStep = getStepFromPathname(pathname);
  const phaseLabel = getPhaseLabel(activeStep);

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border-glass bg-surface-1/80 px-4 py-3 backdrop-blur-sm lg:px-6">
      <div>
        <h1 className="font-display text-lg font-semibold text-text-primary">
          {project.title}
        </h1>
        <p className="text-xs text-text-muted">
          {PROJECT_TYPE_LABELS[project.projectType]} · {phaseLabel}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-2 text-xs text-text-dim">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Saved
        </span>
        <Button href={projectRoutes.dashboard()} variant="ghost" size="sm">
          Back to Dashboard
        </Button>
      </div>
    </header>
  );
}
