import type { Project } from "@/types/project";

export const MOCK_PROJECT_ID = "mock-project";

export const mockProjects: Project[] = [
  {
    id: MOCK_PROJECT_ID,
    title: "The Tank",
    projectType: "feature_film",
    pitchPurpose: "investor",
    storyStage: "synopsis_ready",
    genres: ["Survival Thriller", "Suspense Drama", "Childhood Comedy"],
    tone: ["Dark", "Emotional", "Claustrophobic", "Urgent"],
    language: "Telugu",
    productionStatus: "development",
    status: "content",
    updatedAt: "Today",
  },
  {
    id: "swargalokam",
    title: "Swargalokam",
    projectType: "feature_film",
    pitchPurpose: "producer",
    storyStage: "raw_idea",
    genres: ["Comedy", "Crime", "Fantasy"],
    tone: ["Fun", "Chaotic", "Spiritual"],
    language: "Telugu",
    productionStatus: "development",
    status: "intake",
    updatedAt: "Yesterday",
  },
  {
    id: "startup-pelli",
    title: "Startup Pelli",
    projectType: "feature_film",
    pitchPurpose: "ott",
    storyStage: "one_line",
    genres: ["Romance", "Entrepreneurship Drama", "Cultural Comedy"],
    tone: ["Romantic", "Premium", "Realistic"],
    language: "Telugu",
    productionStatus: "script_ready",
    status: "outline",
    updatedAt: "3 days ago",
  },
];

export function getProjectById(id: string): Project {
  return (
    mockProjects.find((p) => p.id === id) ?? {
      ...mockProjects[0],
      id,
      title: "Untitled Project",
    }
  );
}

export function hasFullDeckData(projectId: string): boolean {
  return projectId === MOCK_PROJECT_ID;
}
