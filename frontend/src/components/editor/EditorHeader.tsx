"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { getProject } from "@/lib/api";
import { projectRoutes } from "@/lib/routes";

interface EditorHeaderProps {
  projectId: string;
  onReview: () => void;
  onExport: () => void;
  saveStatus?: string;
}

export function EditorHeader({
  projectId,
  onReview,
  onExport,
  saveStatus = "Saved",
}: EditorHeaderProps) {
  const [title, setTitle] = useState("Project");
  useEffect(() => {
    getProject(projectId)
      .then((p) => setTitle(p.title || "Project"))
      .catch(() => {});
  }, [projectId]);

  return (
    <header className="editor-header flex h-[52px] shrink-0 items-center justify-between border-b border-white/[0.08] bg-[#101010]/95 px-4 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href={projectRoutes.dashboard()}
          className="shrink-0 font-display text-sm font-semibold tracking-wide text-[#F5F1E8] transition-colors hover:text-[#22d3ee]"
        >
          Pitch Deck Studio
        </Link>
        <span className="text-white/20">|</span>
        <span className="truncate text-sm text-[#9CA3AF]">{title}</span>
        <Badge variant="neon" className="hidden sm:inline-flex">
          Design Generated
        </Badge>
      </div>

      <div className="hidden items-center gap-2 md:flex">
        <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-[#22d3ee]">
          Editor
        </span>
        <span className="text-[11px] text-[#6b7280]">{saveStatus}</span>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onReview}>
          Review
        </Button>
        <Button variant="primary" size="sm" onClick={onExport}>
          Export
        </Button>
      </div>
    </header>
  );
}
