"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { mockOutline } from "@/lib/mock/mock-deck";
import { projectRoutes } from "@/lib/routes";
import { SLIDE_TYPE_LABELS } from "@/types/slide";

interface OutlinePanelProps {
  projectId: string;
}

export function OutlinePanel({ projectId }: OutlinePanelProps) {
  const router = useRouter();

  return (
    <div className="space-y-8">
      <div className="grid gap-4">
        {mockOutline.map((item) => (
          <Card key={item.slideNumber} hover>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-sm font-medium text-accent-neon">
                  {item.slideNumber}
                </span>
                <div>
                  <h3 className="font-semibold text-text-primary">{item.title}</h3>
                  <p className="mt-1 text-sm text-text-muted">{item.purpose}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={item.required ? "neon" : "outline"}>
                  {item.required ? "Required" : "Optional"}
                </Badge>
                <Badge variant="muted">{SLIDE_TYPE_LABELS[item.slideType]}</Badge>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap justify-end gap-4">
        <Button variant="secondary">Regenerate Outline</Button>
        <Button variant="secondary">Add Slide</Button>
        <Button onClick={() => router.push(projectRoutes.content(projectId))}>
          Approve Outline
        </Button>
      </div>
    </div>
  );
}
