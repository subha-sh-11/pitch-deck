"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ResizeHandle } from "@/components/ui/ResizeHandle";
import { DeckExportMenu } from "@/features/export/DeckExportButtons";
import { getProject } from "@/lib/api";
import { FALLBACK_DESIGN } from "@/lib/deck-themes";
import { projectRoutes } from "@/lib/routes";
import { usePanel } from "@/lib/use-panel";
import { ChatPanel } from "./intake/ChatPanel";
import { DeckCanvas } from "./intake/DeckCanvas";
import { DesignBrief } from "./intake/DesignBrief";
import { SlideWorkshop } from "./intake/SlideWorkshop";
import { WorkshopProvider } from "./intake/workshop";
import { useInterview } from "./intake/useInterview";
import { useSetupWizard } from "./SetupWizardContext";

type Tab = "questions" | "slides" | "preview";

const STEPS: { id: Tab; n: number; label: string }[] = [
  { id: "questions", n: 1, label: "Brief" },
  { id: "slides", n: 2, label: "Slides" },
  { id: "preview", n: 3, label: "Present" },
];

// Claude "Design Files" inspired: a resizable conversation rail on the left, a rich
// artifact on the right — a pre-filled Questions brief or a live deck Presentation.
export function IntakeStudio({ projectId }: { projectId: string }) {
  return (
    <WorkshopProvider projectId={projectId}>
      <StudioShell projectId={projectId} />
    </WorkshopProvider>
  );
}

function StudioShell({ projectId }: { projectId: string }) {
  const iv = useInterview(projectId);
  const { saveStatus } = useSetupWizard();
  const [tab, setTab] = useState<Tab>("questions");

  // The assistant rail: 280–520px, persisted, collapsible to a 48px strip. Ctrl+\ toggles.
  const chat = usePanel({
    key: "intake-chat", defaultSize: 340, min: 280, max: 520, side: "left", viewportFraction: 0.38,
  });
  const { toggle: toggleChat } = chat;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
        e.preventDefault();
        toggleChat();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleChat]);

  useEffect(() => {
    getProject(projectId)
      .then((p) => iv.setProjectName(p.title || "Untitled project"))
      .catch(() => {});
    // load the project name once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Nothing is mandatory — the director can build as soon as they've given ANY
  // of title / synopsis / logline (or the agent marks itself ready).
  const canBuild =
    iv.ready ||
    [iv.form.title, iv.form.logline, iv.form.synopsis].some((v) => (v ?? "").trim().length > 0);

  const hasDeck = iv.draftSlides.length > 0;
  const busyBuilding = iv.building || iv.generationStatus === "generating";

  const startBuild = () => {
    if (
      hasDeck &&
      !window.confirm("Regenerate the deck from the current brief? Your current slides are archived first.")
    ) {
      return;
    }
    setTab("slides"); // the workshop: prepare the outline, then craft slide by slide
    void iv.build();
  };

  return (
    <div
      style={{ "--chat-w": `${chat.size}px` } as CSSProperties}
      className="flex h-dvh w-full max-w-[100vw] overflow-hidden bg-surface-0 max-lg:flex-col"
    >
      {/* Left rail — the conversation (collapses to a 48px strip on desktop; on
          small screens the chat IS the page, so collapse only applies at lg+). */}
      {chat.collapsed && (
        <div className="hidden w-14 shrink-0 flex-col items-center gap-1 border-r border-border-glass bg-surface-1/40 py-2 lg:flex">
          <button
            type="button"
            onClick={() => chat.setCollapsed(false)}
            title="Open the AI assistant (Ctrl+\)"
            className="flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-lg text-text-dim transition-colors hover:bg-surface-2 hover:text-accent-neon"
          >
            <SparkIcon />
            <span className="text-[9px] font-semibold uppercase tracking-wider">AI</span>
          </button>
        </div>
      )}
      <section
        className={`${
          chat.collapsed ? "flex lg:hidden" : "flex"
        } min-h-0 w-full min-w-0 flex-col overflow-hidden border-b border-border-glass max-lg:flex-1 lg:w-[var(--chat-w)] lg:shrink-0 lg:border-b-0`}
      >
        <ChatPanel
          iv={iv}
          onCollapse={() => chat.setCollapsed(true)}
          onReviewBrief={() => setTab("questions")}
        />
      </section>
      {!chat.collapsed && (
        <ResizeHandle dragging={chat.dragging} className="max-lg:hidden" {...chat.handleProps} />
      )}

      {/* Right — artifact */}
      <section className="hidden min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-1/20 lg:flex">
        <header className="relative flex h-14 shrink-0 items-center gap-3 border-b border-border-glass bg-surface-0/60 px-4 backdrop-blur">
          <nav className="flex min-w-0 items-center gap-2 text-sm">
            <Link
              href={projectRoutes.dashboard()}
              className="flex shrink-0 items-center gap-1.5 text-text-muted transition-colors hover:text-text-primary"
            >
              <FolderIcon />
              Dashboard
            </Link>
            <span className="text-text-dim">/</span>
            <span className="max-w-[200px] truncate font-medium text-text-primary">{iv.projectName}</span>
            <SaveBadge status={saveStatus} offline={iv.offline} />
          </nav>

          {/* Step flow — centred so it reads as the page's backbone: 1 → 2 → 3. */}
          <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 rounded-full border border-border-glass bg-surface-1/60 p-1 xl:flex">
            {STEPS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setTab(s.id)}
                className={`flex items-center gap-2 rounded-full py-1.5 pl-2 pr-3.5 text-sm font-medium transition-colors ${
                  tab === s.id ? "bg-surface-3 text-text-primary" : "text-text-dim hover:text-text-muted"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                    tab === s.id ? "bg-accent-neon text-zinc-950" : "bg-surface-2 text-text-dim"
                  }`}
                >
                  {s.n}
                </span>
                {s.label}
              </button>
            ))}
          </div>
          {/* Compact stepper for narrower windows */}
          <div className="flex items-center gap-1 rounded-lg bg-surface-2/60 p-0.5 xl:hidden">
            {STEPS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setTab(s.id)}
                className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  tab === s.id ? "bg-surface-0 text-text-primary shadow-sm" : "text-text-dim hover:text-text-muted"
                }`}
              >
                {s.n} · {s.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2.5">
            {hasDeck && (
              <DeckExportMenu slides={iv.draftSlides} design={iv.designDirection ?? FALLBACK_DESIGN} />
            )}
            <button
              type="button"
              disabled={!canBuild || busyBuilding}
              title={
                canBuild
                  ? hasDeck
                    ? "Rebuild the deck from the current brief"
                    : "Build your deck"
                  : "Add a story idea, logline, or synopsis to enable"
              }
              onClick={startBuild}
              className="flex h-10 items-center rounded-full bg-accent-neon px-4 text-sm font-semibold text-zinc-950 shadow-[0_0_20px_rgba(248,201,164,0.3)] transition-all hover:bg-accent-neon-dim active:scale-95 disabled:cursor-not-allowed disabled:bg-accent-neon/25 disabled:text-zinc-950/60 disabled:shadow-none disabled:active:scale-100"
            >
              {busyBuilding ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-950/30 border-t-zinc-950" />
                  Building…
                </span>
              ) : hasDeck ? (
                "Regenerate"
              ) : (
                "Build deck →"
              )}
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">
          {tab === "questions" ? (
            <div className="flex h-full min-h-0 flex-col">
              <div className="min-h-0 flex-1 overflow-hidden">
                <DesignBrief iv={iv} projectId={projectId} />
              </div>
            </div>
          ) : tab === "slides" ? (
            <SlideWorkshop
              onAssembled={() => {
                setTab("preview");
                // Canva-style spatial default once a deck exists: the canvas gets the
                // room; the assistant collapses to its rail (one click / Ctrl+\ reopens).
                chat.setCollapsed(true);
              }}
            />
          ) : (
            <DeckCanvas iv={iv} />
          )}
        </div>
      </section>
    </div>
  );
}

/** Save state pinned next to the deck title: Saving… / Saved / Offline. */
function SaveBadge({ status, offline }: { status: "idle" | "saving" | "saved" | "error"; offline: boolean }) {
  if (offline || status === "error") {
    return (
      <span className="ml-1 flex shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        Offline
      </span>
    );
  }
  if (status === "saving") {
    return (
      <span className="ml-1 flex shrink-0 items-center gap-1 px-1 text-[11px] text-text-dim">
        <span className="h-2.5 w-2.5 animate-spin rounded-full border border-text-dim border-t-transparent" />
        Saving…
      </span>
    );
  }
  if (status === "saved") {
    return <span className="ml-1 shrink-0 px-1 text-xs text-text-muted">Saved</span>;
  }
  return null;
}

function SparkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2 9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="text-text-dim">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}
