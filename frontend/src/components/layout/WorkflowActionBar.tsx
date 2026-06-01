import type { ReactNode } from "react";

interface WorkflowActionBarProps {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
}

export function WorkflowActionBar({
  left,
  right,
  className = "",
}: WorkflowActionBarProps) {
  return (
    <div
      className={`mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border-glass pb-4 ${className}`}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3">{left}</div>
      <div className="flex flex-wrap items-center gap-3">{right}</div>
    </div>
  );
}
