import Link from "next/link";
import { projectRoutes } from "@/lib/routes";

interface PhaseBreadcrumbProps {
  projectId: string;
  current: "template" | "preview" | "editor";
}

const phases = [
  { key: "setup" as const, label: "Setup", href: (id: string) => projectRoutes.setupIdentity(id) },
  { key: "template" as const, label: "Template", href: (id: string) => projectRoutes.templates(id) },
  { key: "preview" as const, label: "Preview", href: null },
  { key: "editor" as const, label: "Editor", href: (id: string) => projectRoutes.editor(id) },
];

export function PhaseBreadcrumb({ projectId, current }: PhaseBreadcrumbProps) {
  const currentIndex = phases.findIndex((p) => p.key === current);

  return (
    <nav
      className="mb-3 flex shrink-0 flex-wrap items-center gap-2"
      aria-label="Workflow progress"
    >
      {phases.map((phase, i) => {
        const isPast = i < currentIndex;
        const isCurrent = phase.key === current;
        const isFuture = i > currentIndex;

        const pill = (
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
              isCurrent
                ? "bg-[#22d3ee]/15 text-[#22d3ee] ring-1 ring-[#22d3ee]/30"
                : isPast
                  ? "bg-white/[0.04] text-[#9CA3AF]"
                  : "text-[#6b7280]"
            }`}
          >
            {phase.label}
          </span>
        );

        return (
          <span key={phase.key} className="flex items-center gap-2">
            {i > 0 && <span className="text-[#3f3f46]">/</span>}
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
  );
}
