"use client";

import { useRouter } from "next/navigation";
import { SectionCard } from "@/components/layout/SectionCard";
import { Button } from "@/components/ui/Button";
import { mockDesignDirection } from "@/lib/mock/mock-deck";
import { projectRoutes } from "@/lib/routes";

interface DesignDirectionPanelProps {
  projectId: string;
}

export function DesignDirectionPanel({ projectId }: DesignDirectionPanelProps) {
  const router = useRouter();
  const d = mockDesignDirection;

  return (
    <div className="space-y-8">
      <div className="grid gap-6 md:grid-cols-2">
        <SectionCard title="Mood">
          <p className="text-lg font-medium text-text-primary">{d.mood}</p>
        </SectionCard>
        <SectionCard title="Cinematic Tone">
          <p className="text-sm text-text-muted">{d.cinematicTone}</p>
        </SectionCard>
      </div>

      <SectionCard title="Color Palette">
        <div className="flex flex-wrap gap-4">
          {d.palette.map((color) => (
            <div key={color.name} className="flex items-center gap-3">
              <div
                className="h-12 w-12 rounded-xl border border-border-glass"
                style={{ backgroundColor: color.hex }}
              />
              <div>
                <p className="text-sm font-medium text-text-primary">{color.name}</p>
                <p className="text-xs text-text-dim">{color.hex}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Typography Direction">
        <ul className="space-y-2 text-sm text-text-muted">
          <li>{d.typography.headings}</li>
          <li>{d.typography.body}</li>
          <li>{d.typography.accents}</li>
          <li>{d.typography.treatment}</li>
        </ul>
      </SectionCard>

      <SectionCard title="Visual Style">
        <div className="flex flex-wrap gap-2">
          {d.visualStyle.map((item) => (
            <span key={item} className="rounded-full border border-border-glass px-3 py-1 text-xs text-text-muted">
              {item}
            </span>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-6 md:grid-cols-3">
        <SectionCard title="Background Style">
          <p className="text-sm text-text-muted">{d.backgroundStyle}</p>
        </SectionCard>
        <SectionCard title="Image Style">
          <p className="text-sm text-text-muted">{d.imageStyle}</p>
        </SectionCard>
        <SectionCard title="Layout Style">
          <p className="text-sm text-text-muted">{d.layoutStyle}</p>
        </SectionCard>
      </div>

      <SectionCard title="Design Rationale">
        <p className="text-sm leading-relaxed text-text-muted">{d.rationale}</p>
      </SectionCard>

      <div className="flex flex-wrap justify-end gap-4">
        <Button variant="secondary">Regenerate Design Direction</Button>
        <Button variant="secondary">Edit Palette</Button>
        <Button onClick={() => router.push(projectRoutes.editor(projectId))}>
          Generate Slide Layouts
        </Button>
      </div>
    </div>
  );
}
