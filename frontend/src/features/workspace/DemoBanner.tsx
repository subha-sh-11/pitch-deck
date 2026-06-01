import Link from "next/link";
import { hasFullDeckData } from "@/lib/mock/mock-projects";

interface DemoBannerProps {
  projectId: string;
}

export function DemoBanner({ projectId }: DemoBannerProps) {
  if (hasFullDeckData(projectId)) return null;

  return (
    <div className="mb-6 rounded-xl border border-accent-neon/30 bg-accent-neon/10 px-4 py-3 text-sm text-accent-neon">
      Demo data for this project is limited.{" "}
      <Link href="/projects/mock-project/intake" className="underline hover:text-accent-neon-dim">
        View full workflow with The Tank
      </Link>
    </div>
  );
}
