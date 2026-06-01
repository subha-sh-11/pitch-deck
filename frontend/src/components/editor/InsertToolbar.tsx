"use client";

import {
  IconChart,
  IconEmbed,
  IconMedia,
  IconRecord,
  IconShape,
  IconTable,
  IconText,
} from "./EditorIcons";

const TOOLS = [
  { id: "text", label: "Text", Icon: IconText },
  { id: "media", label: "Media", Icon: IconMedia },
  { id: "shape", label: "Shape", Icon: IconShape },
  { id: "chart", label: "Chart", Icon: IconChart },
  { id: "table", label: "Table", Icon: IconTable },
  { id: "embed", label: "Embed", Icon: IconEmbed },
  { id: "record", label: "Record", Icon: IconRecord },
] as const;

interface InsertToolbarProps {
  onInsert: (tool: string) => void;
  compact?: boolean;
}

export function InsertToolbar({ onInsert, compact }: InsertToolbarProps) {
  return (
    <div
      className={`flex items-center gap-0.5 rounded-xl bg-[#F8F8FA] p-1 ${
        compact ? "flex-wrap justify-center" : ""
      }`}
    >
      {TOOLS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onInsert(id)}
          className="flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[#5C5C66] transition-colors hover:bg-white hover:text-[#1A1A1F] hover:shadow-sm"
        >
          <Icon className="h-[18px] w-[18px]" />
          <span className="text-[10px] font-medium">{label}</span>
        </button>
      ))}
    </div>
  );
}
