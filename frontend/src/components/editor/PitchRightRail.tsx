"use client";

import {
  IconChecklist,
  IconComment,
  IconMagic,
  IconNotes,
  IconTransition,
  IconUser,
} from "./EditorIcons";

export type RightRailPanel =
  | "design"
  | "transitions"
  | "comments"
  | "notes"
  | "checklist"
  | "profile"
  | null;

interface PitchRightRailProps {
  activePanel: RightRailPanel;
  onPanelChange: (panel: RightRailPanel) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

const RAIL_ITEMS: { id: RightRailPanel; Icon: typeof IconMagic; label: string }[] = [
  { id: "design", Icon: IconMagic, label: "Design" },
  { id: "transitions", Icon: IconTransition, label: "Transitions" },
  { id: "comments", Icon: IconComment, label: "Comments" },
  { id: "notes", Icon: IconNotes, label: "Speaker notes" },
  { id: "checklist", Icon: IconChecklist, label: "Review" },
  { id: "profile", Icon: IconUser, label: "Profile" },
];

export function PitchRightRail({
  activePanel,
  onPanelChange,
  zoom,
  onZoomChange,
}: PitchRightRailProps) {
  function toggle(panel: RightRailPanel) {
    onPanelChange(activePanel === panel ? null : panel);
  }

  return (
    <aside className="flex w-[52px] shrink-0 flex-col items-center border-l border-[#E0E0E5] bg-white py-3">
      <div className="flex flex-1 flex-col items-center gap-1">
        {RAIL_ITEMS.map(({ id, Icon, label }) => (
          <button
            key={id}
            type="button"
            aria-label={label}
            aria-pressed={activePanel === id}
            onClick={() => toggle(id)}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
              activePanel === id
                ? "bg-[#EEF0FF] text-[#4F46E5]"
                : "text-[#5C5C66] hover:bg-[#F0F0F3]"
            }`}
          >
            <Icon className="h-5 w-5" />
          </button>
        ))}
      </div>

      <div className="mt-auto flex flex-col items-center gap-2 pb-2">
        <button
          type="button"
          onClick={() => onZoomChange(Math.max(50, zoom - 10))}
          aria-label="Zoom out"
          className="text-[10px] text-[#9CA3AF] hover:text-[#1A1A1F]"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => onZoomChange(100)}
          aria-label={`Reset zoom to 100%, current ${zoom}%`}
          className="text-xs font-medium tabular-nums text-[#5C5C66] hover:text-[#1A1A1F]"
        >
          {zoom}%
        </button>
        <button
          type="button"
          onClick={() => onZoomChange(Math.min(125, zoom + 10))}
          aria-label="Zoom in"
          className="text-[10px] text-[#9CA3AF] hover:text-[#1A1A1F]"
        >
          +
        </button>
      </div>
    </aside>
  );
}
