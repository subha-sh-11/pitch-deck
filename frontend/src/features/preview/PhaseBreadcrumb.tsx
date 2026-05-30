import Link from "next/link";
import { projectRoutes } from "@/lib/routes";

interface PhaseBreadcrumbProps {
  projectId: string;
  current: "template" | "preview" | "editor";
}

const phases = [
  { key: "template" as const, label: "Template" },
  { key: "preview" as const, label: "Preview" },
  { key: "editor" as const, label: "Editor" },
];

export function PhaseBreadcrumb({ projectId, current }: PhaseBreadcrumbProps) {
  const currentIndex = phases.findIndex((p) => p.key === current);

  return (
    <nav className="mb-8 flex flex-wrap items-center gap-2 text-xs text-text-dim">
      <Link href={projectRoutes.setupIdentity(projectId)} className="hover:text-text-muted">
        Setup
      </Link>
      {phases.map((phase, i) => (
        <span key={phase.key} className="flex items-center gap-2">
          <span>/</span>
          <span
            className={
              i <= currentIndex ? "text-accent-gold" : "text-text-dim"
            }
          >
            {phase.label}
          </span>
        </span>
      ))}
    </nav>
  );
}
