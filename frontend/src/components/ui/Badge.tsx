import type { ReactNode } from "react";

type BadgeVariant =
  | "default"
  | "neon"
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
  neon: "bg-accent-neon/15 text-accent-neon border-accent-neon/30 shadow-[0_0_12px_rgba(248,201,164,0.08)]",
  success: "bg-[#a3e635]/15 text-[#a3e635] border-[#a3e635]/30",
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
