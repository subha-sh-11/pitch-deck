"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getProject } from "@/lib/api";
import { projectRoutes } from "@/lib/routes";
import {
  IconAnalytics,
  IconBell,
  IconGrid,
  IconHome,
  IconMenu,
  IconPlay,
} from "./EditorIcons";
import { InsertToolbar } from "./InsertToolbar";

interface PitchTopBarProps {
  projectId: string;
  onInsert: (tool: string) => void;
  onShare: () => void;
  onPresent: () => void;
  menuOpen: boolean;
  onMenuToggle: () => void;
}

export function PitchTopBar({
  projectId,
  onInsert,
  onShare,
  onPresent,
  menuOpen,
  onMenuToggle,
}: PitchTopBarProps) {
  const [title, setTitle] = useState("PROJECT");
  useEffect(() => {
    getProject(projectId)
      .then((p) => setTitle((p.title || "Project").toUpperCase().replace(/\s+/g, " ").trim()))
      .catch(() => {});
  }, [projectId]);

  return (
    <header className="pitch-topbar flex h-[52px] shrink-0 items-center border-b border-[#E0E0E5] bg-white px-3">
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href={projectRoutes.dashboard()}
          aria-label="Home"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[#5C5C66] transition-colors hover:bg-[#F0F0F3] hover:text-[#1A1A1F]"
        >
          <IconHome />
        </Link>
        <button
          type="button"
          onClick={onMenuToggle}
          aria-label="Menu"
          aria-expanded={menuOpen}
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
            menuOpen ? "bg-[#EEF0FF] text-[#4F46E5]" : "text-[#5C5C66] hover:bg-[#F0F0F3]"
          }`}
        >
          <IconMenu />
        </button>
        <span className="max-w-[120px] truncate text-sm font-semibold text-[#1A1A1F]">
          {title}
        </span>
        <span className="rounded-md bg-[#F0F0F3] px-2 py-0.5 text-[11px] font-medium text-[#5C5C66]">
          Private
        </span>
      </div>

      <div className="mx-auto hidden flex-1 justify-center md:flex">
        <InsertToolbar onInsert={onInsert} />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <div className="mr-2 hidden items-center -space-x-2 sm:flex">
          {["AR", "SK", "PM"].map((initials) => (
            <span
              key={initials}
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] text-[10px] font-bold text-white"
            >
              {initials}
            </span>
          ))}
        </div>
        <button
          type="button"
          aria-label="Notifications"
          className="hidden h-9 w-9 items-center justify-center rounded-lg text-[#5C5C66] hover:bg-[#F0F0F3] sm:flex"
        >
          <IconBell />
        </button>
        <button
          type="button"
          aria-label="Grid view"
          className="hidden h-9 w-9 items-center justify-center rounded-lg text-[#5C5C66] hover:bg-[#F0F0F3] md:flex"
        >
          <IconGrid />
        </button>
        <button
          type="button"
          aria-label="Analytics"
          className="hidden h-9 w-9 items-center justify-center rounded-lg text-[#5C5C66] hover:bg-[#F0F0F3] md:flex"
        >
          <IconAnalytics />
        </button>
        <button
          type="button"
          onClick={onShare}
          className="ml-1 rounded-lg bg-[#1A1A1F] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#333]"
        >
          Share
        </button>
        <button
          type="button"
          onClick={onPresent}
          aria-label="Present"
          className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-[#5C5C66] transition-colors hover:bg-[#F0F0F3]"
        >
          <IconPlay />
        </button>
      </div>
    </header>
  );
}
