"use client";

import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import type { IntakeFormData } from "@/types/workflow";
import type { ContentPreviewSection } from "./content-preview-sections";

interface ContentPreviewSectionPanelProps {
  section: ContentPreviewSection;
  draft: IntakeFormData;
  onChange: (key: keyof IntakeFormData, value: string) => void;
}

export function ContentPreviewSectionPanel({
  section,
  draft,
  onChange,
}: ContentPreviewSectionPanelProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-text-primary">
          {section.label}
        </h2>
        <p className="mt-1 text-sm text-text-muted">{section.description}</p>
      </div>

      <div className="glass-panel space-y-5 rounded-2xl p-6">
        {section.fields.map((field) => {
          const value = draft[field.key] ?? "";
          if (field.multiline) {
            return (
              <Textarea
                key={field.key}
                label={field.label}
                value={value}
                placeholder={field.placeholder}
                rows={field.key === "synopsis" ? 6 : 4}
                onChange={(e) => onChange(field.key, e.target.value)}
              />
            );
          }
          return (
            <Input
              key={field.key}
              label={field.label}
              value={value}
              placeholder={field.placeholder}
              onChange={(e) => onChange(field.key, e.target.value)}
            />
          );
        })}
      </div>
    </div>
  );
}
