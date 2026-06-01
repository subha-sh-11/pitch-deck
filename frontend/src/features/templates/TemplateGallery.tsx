"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useSetupWizard } from "@/features/setup/SetupWizardContext";
import {
  getRecommendedTemplates,
  getTemplateById,
} from "@/lib/mock/mock-templates";
import { projectRoutes } from "@/lib/routes";
import { TemplatePreviewCard } from "./TemplatePreviewCard";

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
    <div className="w-full">
      <div className="templates-page-header">
        <Button
          variant="ghost"
          size="sm"
          href={projectRoutes.setupPitch(projectId)}
          className="-ml-2 text-zinc-500"
        >
          ← Back
        </Button>
        <Button
          size="sm"
          className="templates-continue-btn preview-cta-primary"
          onClick={continueToPreview}
          disabled={!selected}
        >
          Continue to slide preview →
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-zinc-100 md:text-[1.65rem]">
          Choose a presentation template
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-zinc-500">
          Each structure includes 10–14 slides. Visual direction is generated from your
          story when you continue.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_240px] lg:gap-8">
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <TemplatePreviewCard
              key={template.id}
              template={template}
              selected={selected === template.id}
              recommended={template.id === topPick}
              onSelect={() => handleSelect(template.id)}
            />
          ))}
        </div>

        {activeTemplate && (
          <aside className="templates-direction-panel h-fit p-4 lg:sticky lg:top-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-neon">
              Visual direction
            </p>
            <p className="mt-2 text-sm font-medium text-zinc-300">
              {activeTemplate.designDirection.mood}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              {activeTemplate.designDirection.cinematicTone}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {activeTemplate.designDirection.palette.map((color) => (
                <div
                  key={color.name}
                  className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1"
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-sm border border-zinc-700"
                    style={{ backgroundColor: color.hex }}
                  />
                  <span className="text-[10px] text-zinc-500">{color.name}</span>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
