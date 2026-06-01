"use client";

import type { ReactNode } from "react";
import { IconClose } from "./EditorIcons";

interface EditorFlyoutProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: "sm" | "md";
}

export function EditorFlyout({
  title,
  open,
  onClose,
  children,
  width = "md",
}: EditorFlyoutProps) {
  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20"
        aria-hidden
        onClick={onClose}
      />
      <aside
        className={`fixed right-[52px] top-[52px] z-50 flex h-[calc(100vh-52px)] flex-col border-l border-[#E0E0E5] bg-white shadow-2xl ${
          width === "sm" ? "w-[280px]" : "w-[320px]"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[#E0E0E5] px-4 py-3">
          <h3 className="text-sm font-semibold text-[#1A1A1F]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="rounded-lg p-1 text-[#5C5C66] hover:bg-[#F0F0F3]"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </aside>
    </>
  );
}
