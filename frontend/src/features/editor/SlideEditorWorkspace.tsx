"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SlideRenderer } from "@/components/slides/SlideRenderer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/layout/SectionCard";
import { AddSlideMenu } from "@/features/preview/AddSlideMenu";
import { useSetupWizard } from "@/features/setup/SetupWizardContext";
import { mockQualityReview } from "@/lib/mock/mock-deck";
import { projectRoutes } from "@/lib/routes";
import { SLIDE_TYPE_LABELS, type SlideType } from "@/types/slide";
import { EditorFilmstrip } from "./EditorFilmstrip";
import { EditorTopBar } from "./EditorTopBar";

interface SlideEditorWorkspaceProps {
  projectId: string;
}

export function SlideEditorWorkspace({ projectId }: SlideEditorWorkspaceProps) {
  const router = useRouter();
  const {
    draftSlides,
    contentApproved,
    selectedTemplateId,
    deleteDraftSlide,
    insertDraftSlideAfter,
    moveDraftSlide,
    regenerateDraftSlide,
  } = useSetupWizard();
  const [index, setIndex] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [regenerating, setRegenerating] = useState(false);

  const slides = draftSlides;

  useEffect(() => {
    if (!contentApproved) {
      if (selectedTemplateId) {
        router.replace(projectRoutes.preview(projectId));
      } else {
        router.replace(projectRoutes.setupIdentity(projectId));
      }
    }
  }, [contentApproved, selectedTemplateId, projectId, router]);

  useEffect(() => {
    if (index >= slides.length && slides.length > 0) {
      setIndex(slides.length - 1);
    }
  }, [slides.length, index]);

  if (!contentApproved) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-0 text-text-muted">
        Redirecting…
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-0 text-text-muted">
        Preparing your deck…
      </div>
    );
  }

  const slide = slides[index];

  function handleDelete() {
    if (deleteDraftSlide(slide.id)) {
      setIndex((i) => Math.max(0, i - 1));
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    await regenerateDraftSlide(slide.id);
    setRegenerating(false);
  }

  return (
    <div className="flex h-screen flex-col bg-surface-0">
      <EditorTopBar
        projectId={projectId}
        onReview={() => setReviewOpen(true)}
        onExport={() => {}}
      />

      <div className="flex flex-1 min-h-0">
        <EditorFilmstrip
          slides={slides}
          activeIndex={index}
          onSelect={setIndex}
        />

        <div className="flex flex-1 flex-col min-w-0 bg-surface-0">
          <div className="flex flex-wrap items-center justify-center gap-2 border-b border-border-glass py-2 px-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={index === 0}
              onClick={() => setIndex((i) => i - 1)}
            >
              Previous
            </Button>
            <span className="text-xs text-text-dim">
              {index + 1} / {slides.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={index === slides.length - 1}
              onClick={() => setIndex((i) => i + 1)}
            >
              Next
            </Button>
            <span className="mx-2 text-text-dim">|</span>
            <Button
              variant="ghost"
              size="sm"
              disabled={index === 0}
              onClick={() => moveDraftSlide(index, "up")}
            >
              Move up
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={index === slides.length - 1}
              onClick={() => moveDraftSlide(index, "down")}
            >
              Move down
            </Button>
            <span className="mx-2 text-text-dim">|</span>
            <button
              type="button"
              className="text-xs text-text-muted hover:text-text-primary px-2"
              onClick={() => setZoom((z) => Math.max(75, z - 10))}
            >
              −
            </button>
            <span className="text-xs text-text-dim w-10 text-center">{zoom}%</span>
            <button
              type="button"
              className="text-xs text-text-muted hover:text-text-primary px-2"
              onClick={() => setZoom((z) => Math.min(125, z + 10))}
            >
              +
            </button>
          </div>

          <div className="flex flex-1 items-center justify-center overflow-auto p-6">
            <div
              className="w-full max-w-4xl transition-transform"
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: "center",
              }}
            >
              <SlideRenderer slide={slide} />
            </div>
          </div>
        </div>

        <aside className="w-64 shrink-0 border-l border-border-glass bg-surface-1 p-4 overflow-y-auto">
          <h3 className="text-sm font-semibold text-text-primary">Properties</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-text-dim">Title</dt>
              <dd className="text-text-primary">{slide.title}</dd>
            </div>
            <div>
              <dt className="text-text-dim">Type</dt>
              <dd>
                <Badge variant="muted">{SLIDE_TYPE_LABELS[slide.slideType]}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-text-dim">Layout</dt>
              <dd className="text-text-muted">{slide.layout.layoutType}</dd>
            </div>
          </dl>
          <div className="mt-6 flex flex-col gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={regenerating}
              onClick={() => void handleRegenerate()}
            >
              {regenerating ? "Regenerating…" : "Regenerate slide"}
            </Button>
            <AddSlideMenu
              label="Add slide after"
              onAdd={(type: SlideType) => insertDraftSlideAfter(index, type)}
            />
            <Button
              variant="ghost"
              size="sm"
              disabled={slides.length <= 1}
              onClick={handleDelete}
            >
              Delete slide
            </Button>
            <Button variant="ghost" size="sm" href={projectRoutes.preview(projectId)}>
              Edit content
            </Button>
            <Button variant="ghost" size="sm" href={projectRoutes.templates(projectId)}>
              Change template
            </Button>
          </div>
        </aside>
      </div>

      {reviewOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
          <div className="h-full w-full max-w-md overflow-y-auto bg-surface-1 border-l border-border-glass p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl font-semibold text-text-primary">
                Deck Review
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setReviewOpen(false)}>
                Close
              </Button>
            </div>
            <p className="text-sm text-text-muted mb-4">
              Overall readiness: {mockQualityReview.overallReadiness}%
            </p>
            <div className="space-y-4">
              {mockQualityReview.findings.map((f) => (
                <SectionCard key={f.slideTitle} title={f.slideTitle}>
                  <p className="text-sm text-text-muted">{f.suggestion}</p>
                </SectionCard>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
