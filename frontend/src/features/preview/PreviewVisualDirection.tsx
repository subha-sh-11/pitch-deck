import type { DesignDirection } from "@/types/design";

interface PreviewVisualDirectionProps {
  designDirection: DesignDirection;
}

export function PreviewVisualDirection({ designDirection }: PreviewVisualDirectionProps) {
  return (
    <section className="preview-visual-direction shrink-0 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#22d3ee]/90">
            Auto visual direction
          </p>
          <p className="mt-1 text-sm text-[#9CA3AF]">{designDirection.mood}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-[11px] text-[#6b7280] sm:inline">Palette</span>
          <div className="flex gap-1.5">
            {designDirection.palette.map((c) => (
              <div
                key={c.name}
                className="group relative"
                title={c.name}
              >
                <span
                  className="block h-7 w-7 rounded-lg border border-white/[0.08] shadow-inner transition-transform hover:scale-110"
                  style={{ backgroundColor: c.hex }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
