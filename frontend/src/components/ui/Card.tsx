import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className = "", hover = false }: CardProps) {
  return (
    <div
      className={`glass-panel rounded-2xl p-6 ${hover ? "transition-colors hover:border-accent-neon/30" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
