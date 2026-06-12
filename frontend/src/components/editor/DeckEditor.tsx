"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { DesignDirection } from "@/types/design";
import type { Slide, SlideAppearance, SlideType } from "@/types/slide";
import { SLIDE_STATUS_LABELS, SLIDE_TYPE_LABELS } from "@/types/slide";
import {
  generateProjectImage,
  getProject,
  regenerateSlideImage,
  uploadSlideImage,
} from "@/lib/api";
import { DEFAULT_SLIDE_APPEARANCE, SLIDE_TRANSITIONS } from "@/lib/slide-appearance";
import { AiAssistantFab } from "./AiAssistantFab";
import { AiCommandPanel } from "./AiCommandPanel";
import { EditorFlyout } from "./EditorFlyout";
import { InsertToolbar } from "./InsertToolbar";
import { PitchRightRail, type RightRailPanel } from "./PitchRightRail";
import { PitchTopBar } from "./PitchTopBar";
import { PresentationMode } from "./PresentationMode";
import { ShareDialog } from "./ShareDialog";
import { SlideCanvas } from "./SlideCanvas";
import { SlideNavigator } from "./SlideNavigator";

interface DeckEditorProps {
  projectId: string;
  slides: Slide[];
  designDirection: DesignDirection;
  /** Backend sync state of edits; shown so users know their work is safe. */
  saveStatus?: "idle" | "saving" | "saved" | "error";
  onDeleteSlide: (id: string) => boolean;
  onInsertAfter: (index: number, type: SlideType) => void;
  onDuplicateSlide: (index: number) => void;
  onMoveSlide: (index: number, direction: "up" | "down") => void;
  onRegenerateSlide: (id: string) => Promise<void>;
  onUpdateSlide: (id: string, patch: Partial<Slide["content"]> & { title?: string }) => void;
  onUpdateSlideMeta: (
    id: string,
    patch: Partial<
      Pick<Slide, "speakerNotes" | "comments" | "transition" | "title">
    > & { appearance?: Partial<SlideAppearance> },
  ) => void;
  onAddComment: (id: string, text: string) => void;
}

const SAVE_STATUS_LABELS: Record<string, string> = {
  saving: "Saving…",
  saved: "All changes saved",
  error: "Couldn't save — retrying on next edit",
};

export function DeckEditor({
  projectId,
  slides,
  designDirection,
  saveStatus = "idle",
  onDeleteSlide,
  onInsertAfter,
  onMoveSlide,
  onDuplicateSlide,
  onRegenerateSlide,
  onUpdateSlide,
  onUpdateSlideMeta,
  onAddComment,
}: DeckEditorProps) {
  const [projectTitle, setProjectTitle] = useState("Project");
  const [aiOpen, setAiOpen] = useState(false);
  useEffect(() => {
    getProject(projectId)
      .then((p) => setProjectTitle(p.title || "Project"))
      .catch(() => {});
  }, [projectId]);

  // Quality review computed from the real deck (no mock data).
  const review = useMemo(() => {
    const hasContent = (s: Slide) => {
      const c = s.content;
      return Boolean(
        c.heading &&
          (c.body ||
            c.bullets?.length ||
            c.items?.length ||
            c.characters?.length ||
            c.comps?.length ||
            c.imageUrl),
      );
    };
    const ready = slides.filter(hasContent).length;
    return {
      overallReadiness: slides.length ? Math.round((ready / slides.length) * 100) : 0,
      findings: slides
        .filter((s) => !hasContent(s))
        .map((s) => ({
          slideTitle: s.title,
          suggestion: "Add copy or imagery to strengthen this slide.",
        })),
    };
  }, [slides]);

  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [shareOpen, setShareOpen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [rightPanel, setRightPanel] = useState<RightRailPanel>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");

  const safeIndex = Math.min(index, Math.max(0, slides.length - 1));
  const slide = slides[safeIndex];

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  function handleInsert(tool: string) {
    if (!slide) return;
    switch (tool) {
      case "text":
        onUpdateSlide(slide.id, {
          body: `${slide.content.body ?? ""}\n\n[New text block — edit me]`.trim(),
        });
        showToast("Text block added to slide");
        break;
      case "media":
        onUpdateSlideMeta(slide.id, {
          appearance: { backgroundKey: "warm-portrait" },
        });
        showToast("Background updated — warm portrait");
        break;
      case "shape":
        onUpdateSlide(slide.id, {
          bullets: [...(slide.content.bullets ?? []), "◆ New shape element"],
        });
        showToast("Shape added to slide");
        break;
      case "chart":
        onUpdateSlide(slide.id, {
          items: [
            ...(slide.content.items ?? []),
            { title: "New metric", description: "Chart data placeholder" },
          ],
        });
        showToast("Chart block added");
        break;
      case "table":
      case "embed":
      case "record":
        showToast(`${tool.charAt(0).toUpperCase() + tool.slice(1)} element added (mock)`);
        break;
      default:
        showToast("Element added");
    }
  }

  function handleAddSlide(type: SlideType) {
    onInsertAfter(slides.length - 1, type);
    setIndex(slides.length);
    showToast(`${SLIDE_TYPE_LABELS[type]} slide added`);
  }

  async function handleRegenerate() {
    if (!slide) return;
    setRegenerating(true);
    await onRegenerateSlide(slide.id);
    setRegenerating(false);
    showToast("Slide regenerated");
  }

  if (!slide) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F0F0F3] text-[#5C5C66]">
        No slides in deck.
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#F0F0F3]">
      <PitchTopBar
        projectId={projectId}
        onInsert={handleInsert}
        onShare={() => setShareOpen(true)}
        onPresent={() => setPresenting(true)}
        menuOpen={menuOpen}
        onMenuToggle={() => setMenuOpen(!menuOpen)}
      />

      {menuOpen && (
        <div className="border-b border-[#E0E0E5] bg-white px-4 py-3 md:hidden">
          <InsertToolbar onInsert={handleInsert} compact />
        </div>
      )}

      {toastMessage && (
        <div className="pointer-events-none fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded-full bg-[#1A1A1F] px-4 py-2 text-sm text-white shadow-lg">
          {toastMessage}
        </div>
      )}

      {saveStatus !== "idle" && (
        <div
          className={`pointer-events-none fixed bottom-4 right-4 z-40 rounded-full px-3 py-1.5 text-xs shadow ${
            saveStatus === "error"
              ? "bg-[#7F1D1D] text-white"
              : "bg-[#1A1A1F]/80 text-white/90"
          }`}
        >
          {SAVE_STATUS_LABELS[saveStatus]}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <SlideNavigator
          slides={slides}
          activeIndex={safeIndex}
          designDirection={designDirection}
          onSelect={setIndex}
          onAddSlide={handleAddSlide}
        />

        <main className="flex min-w-0 flex-1 flex-col">
          <SlideCanvas
            slide={slide}
            zoom={zoom}
            designDirection={designDirection}
            onAppearanceChange={(appearance) =>
              onUpdateSlideMeta(slide.id, { appearance })
            }
            onContentChange={(patch) => onUpdateSlide(slide.id, patch)}
            imageActions={{
              upload: (file) => uploadSlideImage(projectId, file),
              regenerate: async () => {
                // Editor-added slides have client-only ("local-") ids with no DB row,
                // so generate by slide type instead of regenerating a persisted slide.
                if (slide.id.startsWith("local-")) {
                  const r = await generateProjectImage(projectId, slide.slideType);
                  return r.ok ? r.url ?? null : null;
                }
                const r = await regenerateSlideImage(slide.id);
                return r.ok ? r.slide.content.imageUrl ?? null : null;
              },
            }}
            onDuplicate={() => {
              onDuplicateSlide(safeIndex);
              setIndex(safeIndex + 1);
              showToast("Slide duplicated");
            }}
            onDelete={() => {
              if (onDeleteSlide(slide.id)) {
                setIndex((i) => Math.max(0, i - 1));
                showToast("Slide deleted");
              }
            }}
            onResetStyle={() => {
              onUpdateSlideMeta(slide.id, {
                appearance: { ...DEFAULT_SLIDE_APPEARANCE },
              });
              showToast("Slide style reset");
            }}
          />
        </main>

        <PitchRightRail
          activePanel={rightPanel}
          onPanelChange={setRightPanel}
          zoom={zoom}
          onZoomChange={setZoom}
        />
      </div>

      <AiAssistantFab onClick={() => setAiOpen((v) => !v)} />

      <EditorFlyout title="AI assistant" open={aiOpen} onClose={() => setAiOpen(false)}>
        <AiCommandPanel
          projectId={projectId}
          handlers={{
            slides,
            onUpdateSlide,
            onMoveSlide,
            onInsertAfter,
            onDeleteSlide,
            onRegenerateSlide,
          }}
        />
      </EditorFlyout>

      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        projectTitle={projectTitle}
        onToast={showToast}
      />

      {presenting && (
        <PresentationMode
          slides={slides}
          index={safeIndex}
          designDirection={designDirection}
          onIndexChange={setIndex}
          onClose={() => setPresenting(false)}
        />
      )}

      <EditorFlyout
        title="Design"
        open={rightPanel === "design"}
        onClose={() => setRightPanel(null)}
      >
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs text-[#9CA3AF]">Title</dt>
            <dd className="font-medium">{slide.title}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#9CA3AF]">Type</dt>
            <dd>
              <Badge variant="neon">{SLIDE_TYPE_LABELS[slide.slideType]}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[#9CA3AF]">Status</dt>
            <dd>{SLIDE_STATUS_LABELS[slide.status]}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#9CA3AF]">Mood</dt>
            <dd className="text-[#5C5C66]">{designDirection.mood}</dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {designDirection.palette.map((c) => (
            <span
              key={c.name}
              className="inline-flex items-center gap-1 rounded-full border border-[#E0E0E5] px-2 py-0.5 text-[10px]"
            >
              <span className="h-2 w-2 rounded-full" style={{ background: c.hex }} />
              {c.name}
            </span>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={regenerating}
            onClick={() => void handleRegenerate()}
          >
            {regenerating ? "Regenerating…" : "Regenerate slide content"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => showToast("Design updated (mock)")}>
            Regenerate slide design
          </Button>
          <Button variant="ghost" size="sm" onClick={() => showToast("Hierarchy improved (mock)")}>
            Improve visual hierarchy
          </Button>
          <Button variant="ghost" size="sm" onClick={() => showToast("More cinematic (mock)")}>
            Make more cinematic
          </Button>
        </div>
        {slide.imagePrompt && (
          <p className="mt-4 rounded-lg bg-[#F8F8FA] p-3 text-xs leading-relaxed text-[#5C5C66]">
            {slide.imagePrompt}
          </p>
        )}
      </EditorFlyout>

      <EditorFlyout
        title="Transitions"
        open={rightPanel === "transitions"}
        onClose={() => setRightPanel(null)}
        width="sm"
      >
        <p className="mb-3 text-xs text-[#9CA3AF]">Slide transition</p>
        <div className="space-y-1">
          {SLIDE_TRANSITIONS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                onUpdateSlideMeta(slide.id, { transition: t });
                showToast(`Transition: ${t}`);
              }}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                (slide.transition ?? "Fade") === t
                  ? "bg-[#EEF0FF] font-medium text-[#4F46E5]"
                  : "hover:bg-[#F0F0F3]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </EditorFlyout>

      <EditorFlyout
        title="Comments"
        open={rightPanel === "comments"}
        onClose={() => setRightPanel(null)}
      >
        <div className="space-y-3">
          {(slide.comments ?? []).map((c) => (
            <div key={c.id} className="rounded-lg bg-[#F8F8FA] p-3">
              <p className="text-xs font-medium text-[#1A1A1F]">
                {c.author}{" "}
                <span className="font-normal text-[#9CA3AF]">{c.createdAt}</span>
              </p>
              <p className="mt-1 text-sm text-[#5C5C66]">{c.text}</p>
            </div>
          ))}
          {(slide.comments ?? []).length === 0 && (
            <p className="text-sm text-[#9CA3AF]">No comments yet.</p>
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <input
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value)}
            placeholder="Add a comment…"
            className="flex-1 rounded-lg border border-[#E0E0E5] px-3 py-2 text-sm outline-none focus:border-[#4F46E5]"
          />
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              if (!commentDraft.trim()) return;
              onAddComment(slide.id, commentDraft.trim());
              setCommentDraft("");
              showToast("Comment added");
            }}
          >
            Post
          </Button>
        </div>
      </EditorFlyout>

      <EditorFlyout
        title="Speaker notes"
        open={rightPanel === "notes"}
        onClose={() => setRightPanel(null)}
      >
        <textarea
          value={slide.speakerNotes ?? ""}
          onChange={(e) =>
            onUpdateSlideMeta(slide.id, { speakerNotes: e.target.value })
          }
          placeholder="Notes for this slide during presentation…"
          className="h-48 w-full resize-none rounded-lg border border-[#E0E0E5] p-3 text-sm outline-none focus:border-[#4F46E5]"
        />
        <p className="mt-2 text-xs text-[#9CA3AF]">
          Visible in presentation mode at the bottom of the screen.
        </p>
      </EditorFlyout>

      <EditorFlyout
        title="Deck review"
        open={rightPanel === "checklist"}
        onClose={() => setRightPanel(null)}
      >
        <p className="mb-3 text-sm">
          Readiness:{" "}
          <span className="font-semibold text-[#4F46E5]">
            {review.overallReadiness}%
          </span>
        </p>
        <ul className="space-y-3">
          {review.findings.map((f) => (
            <li key={f.slideTitle} className="rounded-lg border border-[#E0E0E5] p-3">
              <p className="text-sm font-medium">{f.slideTitle}</p>
              <p className="mt-1 text-xs text-[#5C5C66]">{f.suggestion}</p>
            </li>
          ))}
        </ul>
      </EditorFlyout>

      <EditorFlyout
        title="Account"
        open={rightPanel === "profile"}
        onClose={() => setRightPanel(null)}
        width="sm"
      >
        <p className="text-sm text-[#5C5C66]">Signed in as filmmaker@studio.com</p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-4"
          onClick={() => showToast("Profile settings (mock)")}
        >
          Account settings
        </Button>
      </EditorFlyout>
    </div>
  );
}
