"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getProject } from "@/lib/api";
import { projectRoutes } from "@/lib/routes";
import { ChatPanel } from "./intake/ChatPanel";
import { DeckCanvas } from "./intake/DeckCanvas";
import { DesignBrief } from "./intake/DesignBrief";
import { SlideWorkshop } from "./intake/SlideWorkshop";
import { SlidePromptDock, WorkshopProvider } from "./intake/workshop";
import { useInterview } from "./intake/useInterview";

type Tab = "questions" | "slides" | "preview";

// Claude "Design Files" inspired: narrow conversation rail on the left, a rich
// artifact on the right — a pre-filled Questions brief or a live deck Preview.
export function IntakeStudio({ projectId }: { projectId: string }) {
  const iv = useInterview(projectId);
  const [tab, setTab] = useState<Tab>("questions");

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

  return (
    <WorkshopProvider projectId={projectId}>
    <div className="grid h-screen w-full max-w-[100vw] grid-cols-1 overflow-hidden bg-surface-0 lg:grid-cols-[minmax(300px,27%)_minmax(0,1fr)]">
      {/* Left — conversation, with the image-prompt dock beneath it in Slides mode */}
      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden border-b border-border-glass lg:border-b-0 lg:border-r">
        {/* Slides mode: two separate agent panels — conversation and slide prompt —
            as distinct cards with breathing room between them. */}
        <div
          className={`flex min-h-0 flex-col overflow-hidden ${
            tab === "slides"
              ? "m-2 mb-0 h-[52%] shrink-0 rounded-xl border border-border-glass bg-surface-1/25"
              : "flex-1"
          }`}
        >
          <ChatPanel iv={iv} />
        </div>
        {tab === "slides" && (
          <div className="flex min-h-0 flex-1 flex-col p-2">
            <SlidePromptDock />
          </div>
        )}
      </section>

      {/* Right — artifact */}
      <section className="hidden min-h-0 min-w-0 flex-col overflow-hidden bg-surface-1/20 lg:flex">
        <header className="flex items-center justify-between gap-3 border-b border-border-glass bg-surface-0/60 px-4 py-2.5 backdrop-blur">
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href={projectRoutes.dashboard()}
              className="flex items-center gap-1.5 text-text-dim transition-colors hover:text-text-primary"
            >
              <FolderIcon />
              Dashboard
            </Link>
            <span className="text-text-dim/50">/</span>
            <span className="max-w-[180px] truncate text-text-dim">{iv.projectName}</span>
            <span className="text-text-dim/50">/</span>
            <span className="font-medium text-text-primary">
              {tab === "questions" ? "Brief" : tab === "slides" ? "Slide Workshop" : "Deck"}
            </span>
          </nav>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-surface-2/60 p-0.5">
              <TabButton active={tab === "questions"} onClick={() => setTab("questions")}>Questions</TabButton>
              <TabButton active={tab === "slides"} onClick={() => setTab("slides")}>Slides</TabButton>
              <TabButton active={tab === "preview"} onClick={() => setTab("preview")}>Presentation</TabButton>
            </div>
            <button
              type="button"
              disabled={!canBuild || iv.building || iv.generationStatus === "generating"}
              onClick={() => {
                setTab("slides"); // the workshop: prepare the outline, then craft slide by slide
                void iv.build();
              }}
              className="rounded-full bg-accent-neon px-5 py-2 text-sm font-semibold text-zinc-950 shadow-[0_0_20px_rgba(248,201,164,0.3)] transition-colors hover:bg-accent-neon-dim disabled:cursor-not-allowed disabled:bg-accent-neon/25 disabled:text-zinc-950/60 disabled:shadow-none"
            >
              {iv.building || iv.generationStatus === "generating" ? "Building…" : "Build deck →"}
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">
          {tab === "questions" ? (
            <DesignBrief iv={iv} />
          ) : tab === "slides" ? (
            <SlideWorkshop onAssembled={() => setTab("preview")} />
          ) : (
            <DeckCanvas iv={iv} />
          )}
        </div>
      </section>
    </div>
    </WorkshopProvider>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
        active ? "bg-surface-0 text-text-primary shadow-sm" : "text-text-dim hover:text-text-muted"
      }`}
    >
      {children}
    </button>
  );
}

function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="text-text-dim">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}
