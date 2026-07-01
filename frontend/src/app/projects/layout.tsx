import type { ReactNode } from "react";
import { AuthGuard } from "@/components/layout/AuthGuard";

// Gate everything under /projects (new project + every project workspace) behind auth.
export default function ProjectsLayout({ children }: { children: ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
