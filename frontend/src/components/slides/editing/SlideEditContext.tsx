"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { CardGeom, SlideContent, SlideElementEdit, SlideTextBox } from "@/types/slide";

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
  /** Background-image adjustments applied by SlideFrame (blur px / dim 0-1 / zoom scale). */
  imageEffects?: { blur?: number; dim?: number; scale?: number };
  imageActions?: ImageActions;
  selectedId: string | null;
  selectTextBox: (id: string | null) => void;
  /** The currently selected built-in template text element (drives the top toolbar). */
  selectedEl: { k: string; text: string } | null;
  selectEl: (sel: { k: string; text: string } | null) => void;
  setEdit: (key: string, patch: Partial<SlideElementEdit>) => void;
  resetEdit: (key: string) => void;
  /** Patch the slide's content directly (e.g. duplicate/remove a list card). */
  patchContent: (patch: Partial<SlideContent>) => void;
  addTextBox: (xPct: number, yPct: number, init?: Partial<SlideTextBox>) => string;
  updateTextBox: (id: string, patch: Partial<SlideTextBox>) => void;
  /** Free-canvas card geometry (drag/resize a whole card out of the grid). */
  cardLayout: Record<string, CardGeom>;
  setCardGeom: (ck: string, geom: CardGeom | null) => void;
  duplicateTextBox: (id: string) => string;
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
  selectedEl: null,
  selectEl: noop,
  setEdit: noop,
  resetEdit: noop,
  patchContent: noop,
  addTextBox: () => "",
  updateTextBox: noop,
  cardLayout: {},
  setCardGeom: noop,
  duplicateTextBox: () => "",
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
  const cardLayout = content.cardLayout ?? {};
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEl, setSelectedEl] = useState<{ k: string; text: string } | null>(null);

  const value = useMemo<SlideEditValue>(() => {
    const commit = onContentChange ?? noop;
    return {
      editing,
      edits,
      textBoxes,
      imageUrl: content.imageUrl,
      imageEffects: { blur: content.imageBlur, dim: content.imageDim, scale: content.imageScale },
      imageActions,
      selectedId,
      selectTextBox: (id) => {
        setSelectedId(id);
        if (id) setSelectedEl(null); // selecting a free box deselects any template element
      },
      selectedEl,
      selectEl: (sel) => {
        setSelectedEl(sel);
        if (sel) setSelectedId(null); // selecting a template element deselects any free box
      },
      setEdit: (key, patch) =>
        commit({ edits: { ...edits, [key]: { ...edits[key], ...patch } } }),
      patchContent: (patch) => commit(patch),
      resetEdit: (key) => {
        const next = { ...edits };
        delete next[key];
        commit({ edits: next });
      },
      addTextBox: (xPct, yPct, init) => {
        const id = makeId();
        const { id: _ignore, ...initRest } = init ?? {};
        const box: SlideTextBox = {
          text: "New text",
          xPct: Math.max(2, Math.min(90, xPct)),
          yPct: Math.max(2, Math.min(92, yPct)),
          wPct: 30,
          fontSize: 3,
          color: "#F5F1E8",
          align: "left",
          ...initRest, // initial text/style applied in the SAME commit (no stale second write)
          id,
        };
        commit({ textBoxes: [...textBoxes, box] });
        setSelectedId(id); // select the new box so its toolbar shows immediately
        return id;
      },
      updateTextBox: (id, patch) =>
        commit({ textBoxes: textBoxes.map((b) => (b.id === id ? { ...b, ...patch } : b)) }),
      cardLayout,
      setCardGeom: (ck, geom) => {
        const next = { ...cardLayout };
        if (geom) next[ck] = geom;
        else delete next[ck];
        commit({ cardLayout: next });
      },
      duplicateTextBox: (id) => {
        const src = textBoxes.find((b) => b.id === id);
        if (!src) return "";
        const copy: SlideTextBox = {
          ...src,
          id: makeId(),
          xPct: Math.min(90, src.xPct + 4),
          yPct: Math.min(92, src.yPct + 4),
        };
        commit({ textBoxes: [...textBoxes, copy] });
        setSelectedId(copy.id);
        return copy.id;
      },
      removeTextBox: (id) => {
        commit({ textBoxes: textBoxes.filter((b) => b.id !== id) });
        setSelectedId((cur) => (cur === id ? null : cur));
      },
      setImageUrl: (url) => commit({ imageUrl: url }),
    };
    // edits/textBoxes are derived from content; depend on the raw content fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, content.edits, content.textBoxes, content.cardLayout, content.imageUrl, content.imageBlur, content.imageDim, content.imageScale, imageActions, onContentChange, selectedId, selectedEl]);

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
