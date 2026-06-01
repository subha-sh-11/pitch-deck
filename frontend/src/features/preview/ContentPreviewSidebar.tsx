"use client";

import type { ContentPreviewSection, ContentPreviewSectionId } from "./content-preview-sections";

interface ContentPreviewSidebarProps {
  sections: ContentPreviewSection[];
  activeId: ContentPreviewSectionId;
  onSelect: (id: ContentPreviewSectionId) => void;
}

export function ContentPreviewSidebar({
  sections,
  activeId,
  onSelect,
}: ContentPreviewSidebarProps) {
  return (
    <nav
      className="content-preview-nav flex flex-col gap-0.5"
      aria-label="Content sections"
    >
      {sections.map((section) => {
        const active = section.id === activeId;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSelect(section.id)}
            className={`rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
              active
                ? "border-l-2 border-accent-neon bg-white/[0.04] font-medium text-text-primary"
                : "border-l-2 border-transparent text-text-muted hover:bg-white/[0.02] hover:text-text-primary"
            }`}
          >
            {section.label}
          </button>
        );
      })}
    </nav>
  );
}
