"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MarketingShell } from "@/components/layout/MarketingShell";
import { Button } from "@/components/ui/Button";
import { ProjectCard } from "@/features/dashboard/ProjectCard";
import { API_BASE_URL, listProjects } from "@/lib/api";
import { projectRoutes } from "@/lib/routes";
import type { Project } from "@/types/project";

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch((e) => setError(e.message ?? "Failed to load projects"));
  }, []);

  return (
    <MarketingShell>
      <div className="mx-auto max-w-7xl px-6 py-12">
        <PageHeader
          title="Your Pitch Deck Projects"
          subtitle="Manage cinematic pitch decks from idea to export."
          actions={<Button href={projectRoutes.newProject()}>New Project</Button>}
        />

        {error && (
          <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {error} — is the backend running at {API_BASE_URL}?
          </p>
        )}

        {projects === null && !error && (
          <p className="text-sm text-text-muted">Loading projects…</p>
        )}

        {projects && projects.length === 0 && (
          <div className="rounded-xl border border-border-glass bg-surface-1/40 px-6 py-16 text-center">
            <p className="text-text-muted">No projects yet.</p>
            <div className="mt-4 flex justify-center">
              <Button href={projectRoutes.newProject()}>Create your first pitch</Button>
            </div>
          </div>
        )}

        {projects && projects.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onDeleted={(id) =>
                  setProjects((prev) => (prev ? prev.filter((p) => p.id !== id) : prev))
                }
              />
            ))}
          </div>
        )}
      </div>
    </MarketingShell>
  );
}
