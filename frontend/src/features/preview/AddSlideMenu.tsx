"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ADDABLE_SLIDE_TYPES } from "@/lib/regenerate-slide";
import { SLIDE_TYPE_LABELS, type SlideType } from "@/types/slide";

interface AddSlideMenuProps {
  onAdd: (slideType: SlideType) => void;
  label?: string;
}

export function AddSlideMenu({ onAdd, label = "Add slide after" }: AddSlideMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen(!open)}
      >
        {label}
      </Button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-56 overflow-y-auto rounded-xl border border-border-glass bg-surface-2 py-1 shadow-xl">
            {ADDABLE_SLIDE_TYPES.map((item) => (
              <button
                key={item.slideType}
                type="button"
                className="block w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-surface-3"
                onClick={() => {
                  onAdd(item.slideType);
                  setOpen(false);
                }}
              >
                {SLIDE_TYPE_LABELS[item.slideType]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
