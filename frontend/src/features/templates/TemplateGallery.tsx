"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PhaseBreadcrumb } from "@/features/preview/PhaseBreadcrumb";
import { useSetupWizard } from "@/features/setup/SetupWizardContext";
import {
  getRecommendedTemplates,
  getTemplateById,
} from "@/lib/mock/mock-templates";
import { projectRoutes } from "@/lib/routes";

interface TemplateGalleryProps {
  projectId: string;
}

export function TemplateGallery({ projectId }: TemplateGalleryProps) {
  const router = useRouter();
  const {
    formData,
    selectedTemplateId,
    setSelectedTemplate,
    initDraftSlides,
    isStepComplete,
  } = useSetupWizard();
  const [selected, setSelected] = useState(selectedTemplateId);

  useEffect(() => {
    if (!isStepComplete("pitch")) {
      router.replace(projectRoutes.setupPitch(projectId));
    }
  }, [isStepComplete, projectId, router]);

  if (!isStepComplete("pitch")) {
    return null;
  }

  const templates = getRecommendedTemplates(formData.genreBlend, formData.tone);
  const topPick = templates[0]?.id;
  const activeTemplate = selected ? getTemplateById(selected) : undefined;

  function handleSelect(id: string) {
    setSelected(id);
    setSelectedTemplate(id);
  }

  function continueToPreview() {
    if (!selected) return;
    setSelectedTemplate(selected);
    initDraftSlides();
    router.push(projectRoutes.preview(projectId));
  }

  return (
    <>
      <PhaseBreadcrumb projectId={projectId} current="template" />
      <PageHeader
        title="Choose a presentation template"
        subtitle="Each template includes 12+ slides. Visual direction is generated automatically from your story and template style."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => handleSelect(template.id)}
            className="text-left"
          >
            <Card
              hover
              className={`h-full transition-all ${
                selected === template.id
                  ? "ring-2 ring-accent-gold/50 border-accent-gold/40"
                  : ""
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {template.id === topPick && (
                  <Badge variant="gold">Recommended</Badge>
                )}
                <Badge variant="muted">{template.slideCount} slides</Badge>
              </div>
              <h3 className="font-display text-xl font-semibold text-text-primary">
                {template.name}
              </h3>
              <p className="mt-2 text-sm text-text-muted">{template.description}</p>
            </Card>
          </button>
        ))}
      </div>

      {activeTemplate && (
        <div className="mt-8 glass-panel rounded-2xl p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-accent-gold">
            Generated visual direction
          </h3>
          <p className="mt-2 text-sm text-text-muted">{activeTemplate.designDirection.mood}</p>
          <p className="mt-1 text-sm text-text-dim">
            {activeTemplate.designDirection.cinematicTone}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {activeTemplate.designDirection.palette.map((color) => (
              <div key={color.name} className="flex items-center gap-2">
                <div
                  className="h-8 w-8 rounded-lg border border-border-glass"
                  style={{ backgroundColor: color.hex }}
                />
                <span className="text-xs text-text-muted">{color.name}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-text-dim">
            {activeTemplate.designDirection.rationale}
          </p>
        </div>
      )}

      <div className="mt-8 flex justify-between">
        <Button variant="ghost" href={projectRoutes.setupPitch(projectId)}>
          Back
        </Button>
        <Button onClick={continueToPreview} disabled={!selected}>
          Continue to slide preview
        </Button>
      </div>
    </>
  );
}
