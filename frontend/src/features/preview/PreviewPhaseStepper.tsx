import Link from "next/link";
import { projectRoutes } from "@/lib/routes";

interface PreviewPhaseStepperProps {
  projectId: string;
  current: "template" | "preview" | "editor";
}

const phases = [
  { key: "setup" as const, label: "Setup", href: (id: string) => projectRoutes.setupIdentity(id) },
  { key: "template" as const, label: "Template", href: (id: string) => projectRoutes.templates(id) },
  { key: "preview" as const, label: "Preview", href: null },
  { key: "editor" as const, label: "Editor", href: (id: string) => projectRoutes.editor(id) },
];

export function PreviewPhaseStepper({ projectId, current }: PreviewPhaseStepperProps) {
  const currentIndex = phases.findIndex((p) => p.key === current);

  return (
    <div className="preview-phase-track mb-4">
      <nav
        className="flex flex-wrap items-center gap-2"
        aria-label="Workflow progress"
      >
        {phases.map((phase, i) => {
          const isPast = i < currentIndex;
          const isCurrent = phase.key === current;
          const isFuture = i > currentIndex;

          const pill = (
            <span
              className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-[11px] font-medium tracking-wide transition-all duration-300 ${
                isCurrent
                  ? "preview-phase-pill--active"
                  : isPast
                    ? "bg-white/[0.05] text-zinc-400"
                    : "text-zinc-600"
              }`}
            >
              {phase.label}
            </span>
          );

          return (
            <span key={phase.key} className="flex items-center gap-2">
              {i > 0 && (
                <span className="text-zinc-700" aria-hidden>
                  /
                </span>
              )}
              {phase.href && !isFuture ? (
                <Link href={phase.href(projectId)} className="hover:opacity-90">
                  {pill}
                </Link>
              ) : (
                pill
              )}
            </span>
          );
        })}
      </nav>
    </div>
  );
}
