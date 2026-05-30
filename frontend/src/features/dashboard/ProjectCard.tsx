import { StatusBadge } from "@/components/layout/StatusBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
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
}

export function ProjectCard({ project }: ProjectCardProps) {
  const progress = getProgressFromStatus(project.status);

  return (
    <Card hover className="flex flex-col">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-xl font-semibold text-text-primary">
            {project.title}
          </h3>
          <p className="mt-1 text-sm text-text-muted">
            {project.genres.join(" · ")}
          </p>
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

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-text-dim">Updated {project.updatedAt}</span>
        <Button
          href={projectRoutes.setupIdentity(project.id)}
          variant="secondary"
          size="sm"
        >
          Open Workspace
        </Button>
      </div>
    </Card>
  );
}
