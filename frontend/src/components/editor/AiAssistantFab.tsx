"use client";

import { IconSparkle } from "./EditorIcons";

interface AiAssistantFabProps {
  onClick: () => void;
}

export function AiAssistantFab({ onClick }: AiAssistantFabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="AI assistant"
      className="fixed bottom-6 right-[68px] z-30 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F472B6] via-[#A78BFA] to-[#60A5FA] text-white shadow-[0_8px_24px_rgba(167,139,250,0.45)] transition-transform hover:scale-105"
    >
      <IconSparkle className="h-6 w-6" />
    </button>
  );
}
