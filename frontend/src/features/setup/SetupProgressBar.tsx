"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { projectRoutes } from "@/lib/routes";
import type { SetupStepId } from "@/types/setup";
import { useSetupWizard } from "./SetupWizardContext";

const STEPS: { id: SetupStepId; label: string; route: (id: string) => string }[] = [
  { id: "identity", label: "Story Identity", route: projectRoutes.setupIdentity },
  { id: "body", label: "Story Body", route: projectRoutes.setupBody },
  { id: "pitch", label: "Pitch Strength", route: projectRoutes.setupPitch },
];

function stepFromPath(pathname: string): SetupStepId | null {
  if (pathname.includes("/setup/identity")) return "identity";
  if (pathname.includes("/setup/body")) return "body";
  if (pathname.includes("/setup/pitch")) return "pitch";
  return null;
}

export function SetupProgressBar() {
  const pathname = usePathname();
  const active = stepFromPath(pathname);
  const { projectId, isStepComplete, completedSteps } = useSetupWizard();

  const activeIndex = STEPS.findIndex((s) => s.id === active);

  function stepStatus(stepId: SetupStepId, index: number): "completed" | "active" | "locked" {
    if (stepId === active) return "active";
    if (isStepComplete(stepId)) return "completed";
    if (activeIndex >= 0 && index > activeIndex && !completedSteps.includes(STEPS[index - 1]?.id)) {
      return "locked";
    }
    if (activeIndex >= 0 && index > activeIndex) return "locked";
    return isStepComplete(stepId) ? "completed" : "locked";
  }

  return (
    <nav className="mb-10" aria-label="Setup progress">
      <ol className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {STEPS.map((step, index) => {
          const status = stepStatus(step.id, index);
          const canNavigate =
            status === "completed" || status === "active" || isStepComplete(step.id);

          const content = (
            <div
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                status === "active"
                  ? "border-accent-gold/50 bg-accent-gold/10"
                  : status === "completed"
                    ? "border-border-glass bg-surface-2/50 hover:border-accent-gold/30"
                    : "border-border-glass opacity-50 cursor-not-allowed"
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
                  status === "active"
                    ? "bg-accent-gold text-surface-0"
                    : status === "completed"
                      ? "bg-accent-gold/20 text-accent-gold"
                      : "bg-surface-3 text-text-dim"
                }`}
              >
                {status === "completed" ? "✓" : index + 1}
              </span>
              <span className="text-sm font-medium text-text-primary">{step.label}</span>
            </div>
          );

          if (canNavigate) {
            return (
              <li key={step.id} className="flex-1">
                <Link href={step.route(projectId)}>{content}</Link>
              </li>
            );
          }

          return (
            <li key={step.id} className="flex-1">
              {content}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
