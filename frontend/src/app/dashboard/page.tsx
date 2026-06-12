"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { MarketingShell } from "@/components/layout/MarketingShell";
import { ProjectCard } from "@/features/dashboard/ProjectCard";
import { listProjects } from "@/lib/api";
import { projectRoutes } from "@/lib/routes";
import { getProgressFromStatus } from "@/lib/workflow";
import type { Project, ProjectStatus } from "@/types/project";

type SortKey = "updated" | "name" | "progress";
type StatusFilter = "all" | "intake" | "in_editor" | "ready";

function statusGroup(s: ProjectStatus): StatusFilter {
  if (s === "intake" || s === "questions" || s === "story_analysis") return "intake";
  if (s === "export" || s === "completed") return "ready";
  if (s === "review") return "intake"; // shown as "In review" but groups with early stages
  return "in_editor";
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("updated");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch((e) => setError(e.message ?? "Failed to load projects"));
  }, []);

  const visible = useMemo(() => {
    let list = projects ?? [];
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((p) => p.title.toLowerCase().includes(q));
    if (statusFilter !== "all") list = list.filter((p) => statusGroup(p.status) === statusFilter);
    return [...list].sort((a, b) => {
      if (sort === "name") return a.title.localeCompare(b.title);
      if (sort === "progress") return getProgressFromStatus(b.status) - getProgressFromStatus(a.status);
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [projects, query, sort, statusFilter]);

  const hasProjects = !!projects && projects.length > 0;

  return (
    <MarketingShell>
      <div className="mx-auto max-w-7xl px-6 py-12 lg:py-14">
        {/* Header — serif headline, quiet subtext, single projector-lit CTA */}
        <header className="relative mb-10">
          <div className="deck-header-glow" aria-hidden />
          <div className="relative z-[1] flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-display text-4xl font-semibold tracking-tight text-text-primary md:text-[2.75rem]">
                Your Pitch Deck Projects
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-muted">
                Every deck you&rsquo;re shaping — from first spark to final cut.
              </p>
            </div>
            <NewProjectButton className="self-start sm:self-auto" />
          </div>
        </header>

        {error && (
          <p className="mb-6 rounded-xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {error} — is the backend running?
          </p>
        )}

        {projects === null && !error && (
          <p className="text-sm text-text-muted">Loading your screening room…</p>
        )}

        {/* Controls — one frosted instrument panel */}
        {hasProjects && (
          <div className="deck-glass mb-8 flex flex-col gap-2 rounded-2xl p-1.5 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim">
                <SearchIcon />
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects…"
                aria-label="Search projects"
                className="w-full bg-transparent py-2.5 pl-10 pr-3 text-sm text-text-primary placeholder:text-text-dim focus:outline-none"
              />
            </div>
            <Divider />
            <Selectish
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as StatusFilter)}
              ariaLabel="Filter by status"
              options={[
                { value: "all", label: "All statuses" },
                { value: "intake", label: "Intake" },
                { value: "in_editor", label: "In editor" },
                { value: "ready", label: "Ready" },
              ]}
            />
            <Divider />
            <Selectish
              value={sort}
              onChange={(v) => setSort(v as SortKey)}
              ariaLabel="Sort by"
              options={[
                { value: "updated", label: "Recently updated" },
                { value: "name", label: "Name" },
                { value: "progress", label: "Progress" },
              ]}
            />
          </div>
        )}

        {/* Empty: no projects at all */}
        {projects && projects.length === 0 && (
          <div className="deck-glass relative overflow-hidden rounded-3xl px-6 py-20 text-center">
            <div className="deck-header-glow" aria-hidden />
            <p className="relative z-[1] font-display text-2xl text-text-primary">
              Your first pitch starts here
            </p>
            <p className="relative z-[1] mx-auto mt-2.5 max-w-md text-sm text-text-muted">
              Turn a logline, a synopsis, or a script into a producer-ready cinematic deck.
            </p>
            <div className="relative z-[1] mt-7 flex justify-center">
              <NewProjectButton>Create your first deck</NewProjectButton>
            </div>
          </div>
        )}

        {/* Empty: filtered to nothing */}
        {hasProjects && visible.length === 0 && (
          <div className="deck-glass rounded-2xl px-6 py-16 text-center">
            <p className="text-sm text-text-muted">No projects match your search or filter.</p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setStatusFilter("all");
              }}
              className="mt-3 text-sm text-accent-neon transition-colors hover:text-accent-neon-dim"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Gallery — generous gutters, 2 → 4 columns, consistent rhythm */}
        {visible.length > 0 && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-7 xl:grid-cols-4">
            {visible.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onDeleted={(id) => setProjects((prev) => (prev ? prev.filter((p) => p.id !== id) : prev))}
              />
            ))}
          </div>
        )}
      </div>
    </MarketingShell>
  );
}

function NewProjectButton({
  children = "New Project",
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={projectRoutes.newProject()}
      className={`deck-cta inline-flex items-center justify-center gap-2 rounded-xl bg-accent-neon px-5 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-accent-neon-dim ${className}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
      {children}
    </Link>
  );
}

function Selectish({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
}) {
  return (
    <div className="relative">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="deck-select rounded-lg py-2 pl-3 pr-8 text-[13px]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-dim">
        <ChevronIcon />
      </span>
    </div>
  );
}

function Divider() {
  return <div className="hidden h-6 w-px shrink-0 bg-[rgba(255,245,235,0.09)] sm:block" />;
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
