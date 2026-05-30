import type { ReactNode } from "react";

type BadgeVariant =
  | "default"
  | "gold"
  | "success"
  | "warning"
  | "muted"
  | "outline";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-surface-2 text-text-primary border-border-glass",
  gold: "bg-accent-gold/15 text-accent-gold border-accent-gold/30",
  success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  muted: "bg-surface-3 text-text-muted border-border-glass",
  outline: "bg-transparent text-text-muted border-border-glass",
};

export function Badge({
  children,
  variant = "default",
  className = "",
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
