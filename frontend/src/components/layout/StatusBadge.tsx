import { Badge } from "@/components/ui/Badge";
import { PROJECT_STATUS_LABELS, type ProjectStatus } from "@/types/project";

interface StatusBadgeProps {
  status: ProjectStatus;
}

const statusVariant: Record<
  ProjectStatus,
  "default" | "gold" | "success" | "warning" | "muted"
> = {
  intake: "muted",
  questions: "muted",
  story_analysis: "default",
  outline: "default",
  content: "gold",
  design: "gold",
  editor: "gold",
  review: "warning",
  export: "success",
  completed: "success",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge variant={statusVariant[status]}>
      {PROJECT_STATUS_LABELS[status]}
    </Badge>
  );
}
