"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useSetupWizard } from "@/features/setup/SetupWizardContext";
import { listTemplates, recommendTemplate, type TemplateSummary } from "@/lib/api";
import { projectRoutes } from "@/lib/routes";
import { TemplatePreviewCard } from "./TemplatePreviewCard";

interface TemplateGalleryProps {
  projectId: string;
}

export function TemplateGallery({ projectId }: TemplateGalleryProps) {
  const router = useRouter();
  const { selectedTemplateId, setSelectedTemplate, isStepComplete } = useSetupWizard();
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [topPick, setTopPick] = useState<string | undefined>();
  const [selected, setSelected] = useState<string | null>(selectedTemplateId);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isStepComplete("pitch")) {
      router.replace(projectRoutes.setupPitch(projectId));
    }
  }, [isStepComplete, projectId, router]);

  useEffect(() => {
    let active = true;
    Promise.all([listTemplates(), recommendTemplate(projectId).catch(() => null)])
      .then(([tpls, rec]) => {
        if (!active) return;
        setTemplates(tpls);
        const pick = rec?.templateId ?? tpls[0]?.id;
        setTopPick(pick);
        setSelected((cur) => cur ?? pick ?? null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  if (!isStepComplete("pitch")) {
    return null;
  }

  function handleSelect(id: string) {
    setSelected(id);
    setSelectedTemplate(id);
  }

  function continueToPreview() {
    if (!selected) return;
    setSelectedTemplate(selected);
    // Generation runs when the preview page mounts (initDraftSlides → backend).
    router.push(projectRoutes.preview(projectId));
  }

  const activeTemplate = templates.find((t) => t.id === selected);

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

      {loading ? (
        <p className="text-sm text-zinc-500">Loading templates…</p>
      ) : (
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
                Deck structure
              </p>
              <p className="mt-2 text-sm font-medium text-zinc-300">{activeTemplate.name}</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                {activeTemplate.description}
              </p>
              <ol className="mt-3 space-y-1">
                {activeTemplate.slideOutline.map((item) => (
                  <li key={item.slideNumber} className="text-[11px] text-zinc-500">
                    <span className="text-zinc-600">{item.slideNumber}.</span> {item.title}
                  </li>
                ))}
              </ol>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
