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
    if (
      activeIndex >= 0 &&
      index > activeIndex &&
      !completedSteps.includes(STEPS[index - 1]?.id)
    ) {
      return "locked";
    }
    if (activeIndex >= 0 && index > activeIndex) return "locked";
    return isStepComplete(stepId) ? "completed" : "locked";
  }

  return (
    <nav className="setup-progress" aria-label="Setup progress">
      <ol className="setup-progress__list">
        {STEPS.map((step, index) => {
          const status = stepStatus(step.id, index);
          const canNavigate =
            status === "completed" || status === "active" || isStepComplete(step.id);

          const btn = (
            <div className={`setup-progress__btn setup-progress__btn--${status}`}>
              <span
                className={`setup-progress__badge setup-progress__badge--${status}`}
              >
                {status === "completed" ? (
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      d="M2 6l3 3 5-5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  index + 1
                )}
              </span>
              <span className="setup-progress__label">{step.label}</span>
            </div>
          );

          return (
            <li key={step.id} className="setup-progress__step">
              {canNavigate ? (
                <Link href={step.route(projectId)} className="block">
                  {btn}
                </Link>
              ) : (
                btn
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
