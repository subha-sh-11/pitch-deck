import { PageHeader } from "@/components/layout/PageHeader";
import { MarketingShell } from "@/components/layout/MarketingShell";
import { Button } from "@/components/ui/Button";
import { ProjectCard } from "@/features/dashboard/ProjectCard";
import { mockProjects } from "@/lib/mock/mock-projects";
import { projectRoutes } from "@/lib/routes";

export default function DashboardPage() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-7xl px-6 py-12">
        <PageHeader
          title="Your Pitch Deck Projects"
          subtitle="Manage cinematic pitch decks from idea to export."
          actions={
            <Button href={projectRoutes.newProject()}>New Project</Button>
          }
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {mockProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </MarketingShell>
  );
}
