"use client";

import { useRef, useState } from "react";
import { deckCommand } from "@/lib/api/deck";
import { applyDeckActions, type DeckActionHandlers } from "@/lib/apply-deck-actions";

interface Msg {
  role: "user" | "agent";
  text: string;
}

const SUGGESTIONS = [
  "Make the cover moodier",
  "Rewrite the logline punchier",
  "Move the comps slide up",
  "Add a team slide",
];

/**
 * The agent action bar: the director types a plain-language instruction, the slide-edit agent
 * returns structured actions, and we apply them to the live deck through the editor handlers.
 */
export function AiCommandPanel({
  projectId,
  handlers,
}: {
  projectId: string;
  handlers: DeckActionHandlers;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<Msg[]>([
    {
      role: "agent",
      text: "Tell me how to change the deck — e.g. “make the cover darker” or “move the comps slide up”.",
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const send = async (text: string) => {
    const instruction = text.trim();
    if (!instruction || busy) return;
    setDraft("");
    setLog((l) => [...l, { role: "user", text: instruction }]);
    setBusy(true);
    try {
      const slides = handlers.slides.map((s) => ({
        id: s.id,
        slideNumber: s.slideNumber,
        slideType: s.slideType,
        title: s.title,
        content: s.content,
      }));
      const res = await deckCommand(projectId, instruction, slides);
      await applyDeckActions(res.actions, handlers);
      setLog((l) => [
        ...l,
        {
          role: "agent",
          text:
            res.message +
            (res.actions.length ? "" : "\n(no changes made — try rephrasing or be more specific)"),
        },
      ]);
    } catch {
      setLog((l) => [...l, { role: "agent", text: "Sorry — I couldn't reach the editing model. Try again in a moment." }]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 9e9, behavior: "smooth" }));
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto pr-1">
        {log.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "ml-6 rounded-xl bg-[#EEF0FF] px-3 py-2 text-sm text-[#1F2330]"
                : "mr-2 whitespace-pre-line rounded-xl bg-[#F4F4F6] px-3 py-2 text-sm text-[#3A3F4B]"
            }
          >
            {m.text}
          </div>
        ))}
        {busy && <div className="mr-2 rounded-xl bg-[#F4F4F6] px-3 py-2 text-sm text-[#9CA3AF]">Working on it…</div>}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy}
            onClick={() => void send(s)}
            className="rounded-full border border-[#E2E4EC] px-2.5 py-1 text-xs text-[#5C6270] transition-colors hover:border-[#A78BFA] hover:text-[#1F2330] disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-2 flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(draft);
            }
          }}
          rows={2}
          placeholder="Tell the agent what to change…"
          className="flex-1 resize-none rounded-xl border border-[#E2E4EC] bg-white px-3 py-2 text-sm text-[#1F2330] placeholder:text-[#9CA3AF] focus:border-[#A78BFA] focus:outline-none"
        />
        <button
          type="button"
          disabled={busy || !draft.trim()}
          onClick={() => void send(draft)}
          className="rounded-xl bg-gradient-to-br from-[#A78BFA] to-[#60A5FA] px-3.5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}
