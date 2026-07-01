import type { SlideContent } from "@/types/slide";
import { EditableText } from "../editing/EditableText";
import { SlideFrame, SlideLabel } from "../shared/SlideFrame";

interface RelationshipMapSlideProps {
  content: SlideContent;
}

/**
 * Relationship map — character nodes arranged on a ring, connected by labelled lines showing the
 * emotional / conflict relationships that drive the story (protects · hunts · awakens hope in…).
 * Nodes come from `content.characters`; edges from `content.relationships` (source/target = names).
 */
export function RelationshipMapSlide({ content }: RelationshipMapSlideProps) {
  const nodes = content.characters ?? [];
  const rels = content.relationships ?? [];
  const n = nodes.length;

  // Even positions on a ring (percentages of the canvas box).
  const positions = nodes.map((_, i) => {
    const angle = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
    return { x: 50 + Math.cos(angle) * 34, y: 50 + Math.sin(angle) * 36 };
  });
  const indexByName = new Map(
    nodes.map((node, i) => [(node.name || "").trim().toLowerCase(), i]),
  );
  const edges = rels
    .map((r) => ({
      a: indexByName.get((r.source || "").trim().toLowerCase()),
      b: indexByName.get((r.target || "").trim().toLowerCase()),
      label: r.label,
    }))
    .filter((e) => e.a !== undefined && e.b !== undefined && e.a !== e.b) as {
    a: number;
    b: number;
    label?: string;
  }[];

  return (
    <SlideFrame>
      <div className="absolute inset-0 bg-[var(--slide-bg,#0a0a0c)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_50%,rgba(34,211,238,0.06),transparent_55%)]" />
      <div className="relative flex h-full flex-col p-[6%]">
        <SlideLabel>
          <EditableText k="heading" as="span" value={content.heading || "Relationship Map"} />
        </SlideLabel>

        {n === 0 ? (
          <div className="flex flex-1 items-center justify-center text-center text-sm text-[var(--slide-text-muted,#9CA3AF)]">
            {content.body || "The story's character relationships will appear here."}
          </div>
        ) : (
          <div className="relative mt-3 flex-1">
            {/* connector lines (stretched coordinate box; endpoints still align with the node %s) */}
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {edges.map((e, i) => (
                <line
                  key={i}
                  x1={positions[e.a].x}
                  y1={positions[e.a].y}
                  x2={positions[e.b].x}
                  y2={positions[e.b].y}
                  stroke="var(--slide-accent,#22d3ee)"
                  strokeWidth={0.3}
                  strokeOpacity={0.45}
                />
              ))}
            </svg>

            {/* edge labels — own layer so text isn't skewed by preserveAspectRatio="none" */}
            {edges.map((e, i) =>
              e.label ? (
                <span
                  key={i}
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-[9px] font-medium text-[var(--slide-accent,#22d3ee)]"
                  style={{
                    left: `${(positions[e.a].x + positions[e.b].x) / 2}%`,
                    top: `${(positions[e.a].y + positions[e.b].y) / 2}%`,
                    background: "color-mix(in srgb, var(--slide-bg,#0a0a0c) 78%, transparent)",
                  }}
                >
                  {e.label}
                </span>
              ) : null,
            )}

            {/* character nodes */}
            {nodes.map((node, i) => (
              <div
                key={i}
                className="absolute w-[24%] -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${positions[i].x}%`, top: `${positions[i].y}%` }}
              >
                <div className="rounded-lg border border-white/[0.12] bg-white/[0.05] px-3 py-2 text-center backdrop-blur-sm">
                  <p className="truncate font-display text-xs font-semibold text-[var(--slide-text,#F5F1E8)]">
                    {node.name}
                  </p>
                  {node.role && (
                    <p className="truncate text-[9px] text-[var(--slide-accent,#22d3ee)]">{node.role}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SlideFrame>
  );
}
