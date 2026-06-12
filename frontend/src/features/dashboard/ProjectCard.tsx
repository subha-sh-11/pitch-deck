"use client";

import Link from "next/link";
import { useState } from "react";
import { deleteProject } from "@/lib/api";
import { projectRoutes } from "@/lib/routes";
import { getProgressFromStatus } from "@/lib/workflow";
import { timeAgo } from "@/lib/relative-time";
import {
  PITCH_PURPOSE_LABELS,
  PROJECT_TYPE_LABELS,
  type Project,
  type ProjectStatus,
} from "@/types/project";

// Generative "key light" treatments — a directional light raking across a dark
// film set. Chosen deterministically per project so every deck has a distinct
// identity before any artwork is uploaded.
const KEYLIGHTS = [
  "radial-gradient(135% 115% at 20% 6%, #3b4150 0%, #232833 34%, #11141a 72%, #0b0d11 100%)",
  "radial-gradient(135% 115% at 80% 8%, #46392f 0%, #2a2019 36%, #140e0a 74%, #0c0805 100%)",
  "radial-gradient(135% 115% at 50% 4%, #2f3a3d 0%, #1c2426 38%, #0e1314 75%, #090c0d 100%)",
  "radial-gradient(135% 115% at 16% 12%, #3e3550 0%, #251f33 36%, #130f1b 74%, #0c0911 100%)",
  "radial-gradient(135% 115% at 84% 14%, #4a3d36 0%, #2c231d 38%, #150f0b 76%, #0d0907 100%)",
  "radial-gradient(135% 115% at 50% 2%, #38404a 0%, #20262e 38%, #0f1318 76%, #090b0e 100%)",
];

// Subtle film grain (feTurbulence) overlaid on the frame.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

// Status chip: dot uses the same colour for fill and text so its currentColor
// glow matches. Single accent — peach marks the live/advanced states, a quiet
// warm grey marks the early ones; the label carries the precise status.
function statusMeta(s: ProjectStatus): { label: string; dot: string } {
  if (s === "intake" || s === "questions" || s === "story_analysis")
    return { label: "Intake", dot: "bg-text-dim text-text-dim" };
  if (s === "review") return { label: "In review", dot: "bg-text-dim text-text-dim" };
  if (s === "export" || s === "completed")
    return { label: "Ready", dot: "bg-accent-neon text-accent-neon" };
  return { label: "In editor", dot: "bg-accent-neon text-accent-neon" };
}

interface ProjectCardProps {
  project: Project;
  onDeleted?: (id: string) => void;
}

export function ProjectCard({ project, onDeleted }: ProjectCardProps) {
  const progress = getProgressFromStatus(project.status);
  const st = statusMeta(project.status);
  const keylight = KEYLIGHTS[hashId(project.id) % KEYLIGHTS.length];
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setMenuOpen(false);
    if (!window.confirm(`Delete "${project.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteProject(project.id);
      onDeleted?.(project.id);
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div
      className={`deck-card deck-glass group flex flex-col overflow-hidden rounded-[1.25rem] ${
        deleting ? "pointer-events-none opacity-50" : ""
      }`}
    >
      {/* Title-card frame — letterboxed, generative key light */}
      <div className="deck-letterbox relative aspect-[16/10] w-full overflow-hidden">
        <div
          className="absolute inset-0 transition-transform duration-700 ease-out group-hover:-translate-y-[1.5%] group-hover:scale-[1.06]"
          style={{ backgroundImage: keylight }}
        />
        {/* film grain */}
        <div className="absolute inset-0 mix-blend-overlay opacity-[0.08]" style={{ backgroundImage: GRAIN }} />
        {/* vignette */}
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(120% 120% at 50% 32%, transparent 52%, rgba(0,0,0,0.5) 100%)" }}
        />
        {/* peach catch-light — frame catching light on hover */}
        <div
          className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: "radial-gradient(72% 58% at 26% 0%, rgba(248,201,164,0.18), transparent 60%)" }}
        />
        {/* serif initial, set like a title card */}
        <div className="absolute inset-0 z-[3] flex items-center justify-center">
          <span className="deck-initial select-none font-display text-[3.5rem] font-light leading-none text-text-primary/85">
            {project.title.charAt(0).toUpperCase()}
          </span>
        </div>

        {/* status chip */}
        <div className="absolute left-3 top-3 z-[4] inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-black/40 px-2.5 py-1 text-[11px] font-medium text-text-primary/90 backdrop-blur">
          <span className={`deck-dot h-1.5 w-1.5 rounded-full ${st.dot}`} />
          {st.label}
        </div>

        {/* overflow menu */}
        <div className="absolute right-2 top-2 z-20">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="More actions"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-base leading-none text-text-muted opacity-0 backdrop-blur transition-opacity hover:text-text-primary focus:opacity-100 group-hover:opacity-100"
          >
            ⋯
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                aria-hidden
                tabIndex={-1}
                className="fixed inset-0 z-20 cursor-default"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 z-30 mt-1 w-36 overflow-hidden rounded-lg border border-border-glass bg-surface-2 shadow-xl">
                <button
                  type="button"
                  onClick={handleDelete}
                  className="block w-full px-3 py-2 text-left text-xs text-red-400 transition-colors hover:bg-surface-3"
                >
                  Delete project
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="truncate font-display text-[1.15rem] font-semibold leading-snug text-text-primary">
          {project.title}
        </h3>
        <p className="mt-1 truncate text-xs tracking-wide text-text-dim">
          {PROJECT_TYPE_LABELS[project.projectType]} · {PITCH_PURPOSE_LABELS[project.pitchPurpose]}
        </p>

        {/* hairline divider */}
        <div className="deck-hairline mt-4" />

        {/* progress with glowing tip */}
        <div className="mt-3 flex items-center gap-3">
          <div className="deck-progress flex-1">
            <div className="deck-progress__fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[11px] tabular-nums text-text-dim">{progress}%</span>
        </div>

        {/* footer — recency + Open (whole card is the link) */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[11px] text-text-dim">Updated {timeAgo(project.updatedAt)}</span>
          <Link
            href={projectRoutes.setupIdentity(project.id)}
            aria-label={`Open ${project.title}`}
            className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-accent-neon/80 transition-colors hover:text-accent-neon after:absolute after:inset-0 after:z-[5] after:content-['']"
          >
            Open
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
