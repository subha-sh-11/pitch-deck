"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { projectRoutes } from "@/lib/routes";
import { workspaceStepDefinitions } from "@/lib/mock/mock-workflow";
import { buildWorkflowSteps, getPhaseLabel, getStepFromPathname } from "@/lib/workflow";
import type { WorkflowStepStatus } from "@/types/workflow";

interface WorkspaceSidebarProps {
  projectId: string;
}

function StepIcon({ status }: { status: WorkflowStepStatus }) {
  if (status === "completed") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-gold/20 text-xs text-accent-gold">
        ✓
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-gold text-xs font-medium text-surface-0">
        •
      </span>
    );
  }
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border-glass text-xs text-text-dim">
      ○
    </span>
  );
}

export function WorkspaceSidebar({ projectId }: WorkspaceSidebarProps) {
  const pathname = usePathname();
  const activeStep = getStepFromPathname(pathname);
  const steps = buildWorkflowSteps(
    projectId,
    activeStep,
    workspaceStepDefinitions,
  );

  return (
    <aside className="w-full shrink-0 border-b border-border-glass bg-surface-1 lg:w-72 lg:border-b-0 lg:border-r">
      <div className="p-4 lg:p-6">
        <p className="mb-4 text-xs font-medium uppercase tracking-wider text-text-dim">
          Workflow
        </p>
        <nav className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
          {steps.map((step) => (
            <Link
              key={step.id}
              href={projectRoutes.step(projectId, step.id)}
              className={`flex min-w-[200px] items-start gap-3 rounded-xl p-3 transition-colors lg:min-w-0 ${
                step.status === "active"
                  ? "bg-accent-gold/10 border border-accent-gold/30"
                  : "hover:bg-surface-2 border border-transparent"
              }`}
            >
              <StepIcon status={step.status} />
              <div className="min-w-0">
                <p className="text-xs text-text-dim">Step {step.number}</p>
                <p className="font-medium text-text-primary">{step.label}</p>
                <p className="mt-0.5 hidden text-xs text-text-muted lg:block">
                  {step.description}
                </p>
              </div>
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}
