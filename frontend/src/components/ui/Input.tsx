import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className = "", id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-text-primary">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full rounded-xl border border-border-glass bg-surface-2 px-4 py-2.5 text-sm text-text-primary placeholder:text-text-dim focus:border-accent-neon/50 focus:outline-none focus:ring-1 focus:ring-accent-neon/30 ${className}`}
        {...props}
      />
    </div>
  );
}
