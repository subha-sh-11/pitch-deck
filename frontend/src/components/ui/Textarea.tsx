import type { TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
}

export function Textarea({
  label,
  helperText,
  className = "",
  id,
  ...props
}: TextareaProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-text-primary">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={`w-full rounded-xl border border-border-glass bg-surface-2 px-4 py-3 text-sm text-text-primary placeholder:text-text-dim focus:border-accent-gold/50 focus:outline-none focus:ring-1 focus:ring-accent-gold/30 min-h-[100px] resize-y ${className}`}
        {...props}
      />
      {helperText && (
        <p className="text-xs text-text-dim">{helperText}</p>
      )}
    </div>
  );
}
