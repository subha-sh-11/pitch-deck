"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { SlideContent, SlideElementEdit, SlideTextBox } from "@/types/slide";

export interface ImageActions {
  /** Upload a file and return its served URL. */
  upload?: (file: File) => Promise<string>;
  /** Regenerate the slide image; resolves to the new URL, or null if unavailable. */
  regenerate?: () => Promise<string | null>;
}

interface SlideEditValue {
  editing: boolean;
  edits: Record<string, SlideElementEdit>;
  textBoxes: SlideTextBox[];
  imageUrl?: string;
  imageActions?: ImageActions;
  selectedId: string | null;
  selectTextBox: (id: string | null) => void;
  setEdit: (key: string, patch: Partial<SlideElementEdit>) => void;
  resetEdit: (key: string) => void;
  addTextBox: (xPct: number, yPct: number) => string;
  updateTextBox: (id: string, patch: Partial<SlideTextBox>) => void;
  removeTextBox: (id: string) => void;
  setImageUrl: (url: string) => void;
}

const noop = () => {};

const DEFAULT: SlideEditValue = {
  editing: false,
  edits: {},
  textBoxes: [],
  selectedId: null,
  selectTextBox: noop,
  setEdit: noop,
  resetEdit: noop,
  addTextBox: () => "",
  updateTextBox: noop,
  removeTextBox: noop,
  setImageUrl: noop,
};

const SlideEditContext = createContext<SlideEditValue>(DEFAULT);

export const useSlideEdit = () => useContext(SlideEditContext);

interface SlideEditProviderProps {
  content: SlideContent;
  editing?: boolean;
  imageActions?: ImageActions;
  /** Persist a content patch (edits / textBoxes / imageUrl) up to the editor. */
  onContentChange?: (patch: Partial<SlideContent>) => void;
  children: ReactNode;
}

function makeId() {
  return `tb-${Math.random().toString(36).slice(2, 9)}`;
}

export function SlideEditProvider({
  content,
  editing = false,
  imageActions,
  onContentChange,
  children,
}: SlideEditProviderProps) {
  const edits = content.edits ?? {};
  const textBoxes = content.textBoxes ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const value = useMemo<SlideEditValue>(() => {
    const commit = onContentChange ?? noop;
    return {
      editing,
      edits,
      textBoxes,
      imageUrl: content.imageUrl,
      imageActions,
      selectedId,
      selectTextBox: setSelectedId,
      setEdit: (key, patch) =>
        commit({ edits: { ...edits, [key]: { ...edits[key], ...patch } } }),
      resetEdit: (key) => {
        const next = { ...edits };
        delete next[key];
        commit({ edits: next });
      },
      addTextBox: (xPct, yPct) => {
        const id = makeId();
        const box: SlideTextBox = {
          id,
          text: "New text",
          xPct: Math.max(2, Math.min(90, xPct)),
          yPct: Math.max(2, Math.min(92, yPct)),
          wPct: 30,
          fontSize: 3,
          color: "#F5F1E8",
          align: "left",
        };
        commit({ textBoxes: [...textBoxes, box] });
        setSelectedId(id); // select the new box so its toolbar shows immediately
        return id;
      },
      updateTextBox: (id, patch) =>
        commit({ textBoxes: textBoxes.map((b) => (b.id === id ? { ...b, ...patch } : b)) }),
      removeTextBox: (id) => {
        commit({ textBoxes: textBoxes.filter((b) => b.id !== id) });
        setSelectedId((cur) => (cur === id ? null : cur));
      },
      setImageUrl: (url) => commit({ imageUrl: url }),
    };
    // edits/textBoxes are derived from content; depend on the raw content fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, content.edits, content.textBoxes, content.imageUrl, imageActions, onContentChange, selectedId]);

  return <SlideEditContext.Provider value={value}>{children}</SlideEditContext.Provider>;
}

/** Convert a pointer delta (px) into slide-percentage units using the nearest slide root. */
export function pxDeltaToPct(el: HTMLElement | null, dxPx: number, dyPx: number) {
  const root = el?.closest("[data-slide-root]") as HTMLElement | null;
  const rect = root?.getBoundingClientRect();
  if (!rect || !rect.width || !rect.height) return { dxPct: 0, dyPct: 0 };
  return { dxPct: (dxPx / rect.width) * 100, dyPct: (dyPx / rect.height) * 100 };
}

/** Convert an absolute client point into slide-percentage coordinates. */
export function clientPointToPct(root: HTMLElement | null, clientX: number, clientY: number) {
  const rect = root?.getBoundingClientRect();
  if (!rect || !rect.width || !rect.height) return { xPct: 50, yPct: 50 };
  return {
    xPct: ((clientX - rect.left) / rect.width) * 100,
    yPct: ((clientY - rect.top) / rect.height) * 100,
  };
}
