"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/layout/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { deleteProject } from "@/lib/api";
import { projectRoutes } from "@/lib/routes";
import { getProgressFromStatus } from "@/lib/workflow";
import {
  PITCH_PURPOSE_LABELS,
  PROJECT_TYPE_LABELS,
  STORY_STAGE_LABELS,
  type Project,
} from "@/types/project";

interface ProjectCardProps {
  project: Project;
  onDeleted?: (id: string) => void;
}

export function ProjectCard({ project, onDeleted }: ProjectCardProps) {
  const progress = getProgressFromStatus(project.status);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Delete "${project.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteProject(project.id);
      onDeleted?.(project.id);
    } catch {
      setDeleting(false);
    }
  }

  const updated = (() => {
    const d = new Date(project.updatedAt);
    return Number.isNaN(d.getTime()) ? project.updatedAt : d.toLocaleString();
  })();

  return (
    <Card hover className="flex flex-col">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-xl font-semibold text-text-primary">
            {project.title}
          </h3>
          <p className="mt-1 text-sm text-text-muted">{project.genres.join(" · ")}</p>
        </div>
        <StatusBadge status={project.status} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="muted">{PROJECT_TYPE_LABELS[project.projectType]}</Badge>
        <Badge variant="outline">{PITCH_PURPOSE_LABELS[project.pitchPurpose]}</Badge>
        <Badge variant="outline">{STORY_STAGE_LABELS[project.storyStage]}</Badge>
      </div>

      <div className="mt-6">
        <ProgressBar value={progress} showLabel />
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-xs text-text-dim">Updated {updated}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-md border border-red-900/40 px-2.5 py-1.5 text-xs text-red-400/80 transition-colors hover:border-red-700 hover:text-red-300 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
          <Button href={projectRoutes.setupIdentity(project.id)} variant="secondary" size="sm">
            Open Workspace
          </Button>
        </div>
      </div>
    </Card>
  );
}
