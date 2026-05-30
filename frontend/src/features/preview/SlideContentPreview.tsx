"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { useSetupWizard } from "@/features/setup/SetupWizardContext";
import { getTemplateById } from "@/lib/mock/mock-templates";
import { projectRoutes } from "@/lib/routes";
import { SLIDE_TYPE_LABELS } from "@/types/slide";
import { AddSlideMenu } from "./AddSlideMenu";
import { GeneratingOverlay } from "./GeneratingOverlay";
import { PhaseBreadcrumb } from "./PhaseBreadcrumb";
import {
  getSelectedSlide,
  slideContentToText,
  textToSlideContentPatch,
} from "./slide-content-utils";

const GENERATE_DELAY_MS = 2500;

interface SlideContentPreviewProps {
  projectId: string;
}

export function SlideContentPreview({ projectId }: SlideContentPreviewProps) {
  const router = useRouter();
  const {
    draftSlides,
    selectedTemplateId,
    isStepComplete,
    initDraftSlides,
    updateDraftSlide,
    deleteDraftSlide,
    insertDraftSlideAfter,
    regenerateDraftSlide,
    regenerateAllDraftSlides,
    setGenerationStatus,
    approveContent,
    generationStatus,
  } = useSetupWizard();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [bodyText, setBodyText] = useState("");

  useEffect(() => {
    if (!isStepComplete("pitch")) {
      router.replace(projectRoutes.setupPitch(projectId));
    }
  }, [isStepComplete, projectId, router]);

  useEffect(() => {
    if (!selectedTemplateId) {
      router.replace(projectRoutes.templates(projectId));
      return;
    }
    if (draftSlides.length === 0) {
      initDraftSlides();
    }
  }, [selectedTemplateId, draftSlides.length, initDraftSlides, projectId, router]);

  const selected = getSelectedSlide(draftSlides, selectedId);
  const selectedIndex = selected
    ? draftSlides.findIndex((s) => s.id === selected.id)
    : 0;

  useEffect(() => {
    if (draftSlides.length > 0 && !selectedId) {
      setSelectedId(draftSlides[0].id);
    }
  }, [draftSlides, selectedId]);

  useEffect(() => {
    const slide = draftSlides.find((s) => s.id === selectedId) ?? draftSlides[0];
    if (slide) setBodyText(slideContentToText(slide.content));
  }, [selectedId, draftSlides]);

  const template = selectedTemplateId
    ? getTemplateById(selectedTemplateId)
    : undefined;

  if (!isStepComplete("pitch") || !selectedTemplateId) {
    return null;
  }

  if (draftSlides.length === 0 || !selected) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-text-muted">
        Preparing slide preview…
      </div>
    );
  }

  function persistBodyEdit() {
    if (!selected) return;
    updateDraftSlide(
      selected.id,
      textToSlideContentPatch(bodyText, selected.content),
    );
  }

  function handleSelectSlide(id: string) {
    persistBodyEdit();
    setSelectedId(id);
    const slide = draftSlides.find((s) => s.id === id);
    if (slide) setBodyText(slideContentToText(slide.content));
  }

  async function handleRegenerateSlide() {
    if (!selected) return;
    setRegeneratingId(selected.id);
    await regenerateDraftSlide(selected.id);
    setRegeneratingId(null);
  }

  async function handleStartGenerate() {
    persistBodyEdit();
    setGenerationStatus("generating");
    await new Promise((r) => setTimeout(r, GENERATE_DELAY_MS));
    approveContent();
    router.push(projectRoutes.editor(projectId));
  }

  return (
    <>
      {generationStatus === "generating" && <GeneratingOverlay />}

      <PhaseBreadcrumb projectId={projectId} current="preview" />

      <PageHeader
        title="Review slide content"
        subtitle="Edit each slide before generating your pitch deck. Visual direction is applied automatically from your story and template."
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void regenerateAllDraftSlides()}
          >
            Regenerate all
          </Button>
        }
      />

      {template && (
        <div className="mb-6 glass-panel rounded-xl p-4">
          <p className="text-xs uppercase tracking-wider text-accent-gold">
            Auto visual direction
          </p>
          <p className="mt-1 text-sm text-text-muted">{template.designDirection.mood}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {template.designDirection.palette.slice(0, 4).map((c) => (
              <div
                key={c.name}
                className="h-6 w-6 rounded border border-border-glass"
                style={{ backgroundColor: c.hex }}
                title={c.name}
              />
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-2 max-h-[520px] overflow-y-auto">
          {draftSlides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => handleSelectSlide(slide.id)}
              className={`w-full rounded-xl border p-3 text-left transition-colors ${
                selected.id === slide.id
                  ? "border-accent-gold/50 bg-accent-gold/10"
                  : "border-border-glass hover:bg-surface-2"
              }`}
            >
              <span className="text-xs text-text-dim">{slide.slideNumber}</span>
              <p className="font-medium text-text-primary">{slide.title}</p>
              <p className="mt-1 line-clamp-2 text-xs text-text-muted">
                {slideContentToText(slide.content)}
              </p>
            </button>
          ))}
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h3 className="font-display text-xl font-semibold text-text-primary">
              {selected.title}
            </h3>
            <Badge variant="muted">{SLIDE_TYPE_LABELS[selected.slideType]}</Badge>
          </div>
          <p className="mb-4 text-sm text-text-muted">{selected.purpose}</p>

          <Textarea
            label="Heading"
            value={selected.content.heading}
            onChange={(e) =>
              updateDraftSlide(selected.id, { heading: e.target.value })
            }
            rows={1}
            className="min-h-0 mb-4"
          />
          <Textarea
            label="Content"
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            onBlur={persistBodyEdit}
            rows={10}
          />

          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={regeneratingId === selected.id}
              onClick={() => void handleRegenerateSlide()}
            >
              {regeneratingId === selected.id ? "Regenerating…" : "Regenerate slide"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={draftSlides.length <= 1}
              onClick={() => deleteDraftSlide(selected.id)}
            >
              Delete slide
            </Button>
            <AddSlideMenu
              onAdd={(type) => insertDraftSlideAfter(selectedIndex, type)}
            />
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-between gap-4">
        <Button variant="ghost" href={projectRoutes.templates(projectId)}>
          Back to templates
        </Button>
        <Button onClick={() => void handleStartGenerate()}>Start Generate</Button>
      </div>
    </>
  );
}
