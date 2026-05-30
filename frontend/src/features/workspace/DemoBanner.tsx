import Link from "next/link";
import { hasFullDeckData } from "@/lib/mock/mock-projects";

interface DemoBannerProps {
  projectId: string;
}

export function DemoBanner({ projectId }: DemoBannerProps) {
  if (hasFullDeckData(projectId)) return null;

  return (
    <div className="mb-6 rounded-xl border border-accent-gold/30 bg-accent-gold/10 px-4 py-3 text-sm text-accent-gold">
      Demo data for this project is limited.{" "}
      <Link href="/projects/mock-project/intake" className="underline hover:text-accent-gold-dim">
        View full workflow with The Tank
      </Link>
    </div>
  );
}
