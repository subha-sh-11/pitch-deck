import { PageHeader } from "@/components/layout/PageHeader";
import { MarketingShell } from "@/components/layout/MarketingShell";
import { ProjectForm } from "@/features/project-new/ProjectForm";

export default function NewProjectPage() {
  return (
    <MarketingShell>
      <div className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-10">
        <PageHeader
          title="Create New Pitch Deck"
          subtitle="Define your project before the AI intake begins. This is the first step in a serious creative workflow."
        />
        <ProjectForm />
      </div>
    </MarketingShell>
  );
}
