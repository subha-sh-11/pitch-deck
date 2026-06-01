"use client";

import { useState } from "react";
import { IconClose } from "./EditorIcons";

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  projectTitle: string;
  onToast: (message: string) => void;
}

export function ShareDialog({ open, onClose, projectTitle, onToast }: ShareDialogProps) {
  const [email, setEmail] = useState("");
  const link = `https://pitch-deck.studio/share/${projectTitle.toLowerCase().replace(/\s+/g, "-")}`;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#1A1A1F]">Share deck</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share dialog"
            className="rounded-lg p-1 text-[#5C5C66] hover:bg-[#F0F0F3]"
          >
            <IconClose />
          </button>
        </div>

        <p className="mb-4 text-sm text-[#5C5C66]">
          Invite collaborators or share a view-only link for {projectTitle}.
        </p>

        <label className="mb-2 block text-xs font-medium text-[#5C5C66]">
          Invite by email
        </label>
        <div className="mb-4 flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="producer@studio.com"
            className="flex-1 rounded-lg border border-[#E0E0E5] px-3 py-2 text-sm outline-none focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5]"
          />
          <button
            type="button"
            onClick={() => {
              if (email) onToast(`Invite sent to ${email} (mock)`);
              setEmail("");
            }}
            className="rounded-lg bg-[#1A1A1F] px-4 py-2 text-sm font-medium text-white hover:bg-[#333]"
          >
            Send
          </button>
        </div>

        <label className="mb-2 block text-xs font-medium text-[#5C5C66]">
          Share link
        </label>
        <div className="flex gap-2">
          <input
            readOnly
            value={link}
            className="flex-1 rounded-lg border border-[#E0E0E5] bg-[#F8F8FA] px-3 py-2 text-sm text-[#5C5C66]"
          />
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(link);
              onToast("Link copied to clipboard");
            }}
            className="rounded-lg border border-[#E0E0E5] px-4 py-2 text-sm font-medium hover:bg-[#F0F0F3]"
          >
            Copy
          </button>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-[#5C5C66] hover:bg-[#F0F0F3]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onToast("Deck shared (mock)");
              onClose();
            }}
            className="rounded-lg bg-[#4F46E5] px-4 py-2 text-sm font-medium text-white hover:bg-[#4338CA]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
