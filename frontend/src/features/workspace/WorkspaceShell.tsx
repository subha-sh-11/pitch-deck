import type { ReactNode } from "react";
import { WorkspaceSidebar } from "./WorkspaceSidebar";
import { WorkspaceTopbar } from "./WorkspaceTopbar";

interface WorkspaceShellProps {
  projectId: string;
  children: ReactNode;
}

export function WorkspaceShell({ projectId, children }: WorkspaceShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-surface-0 cinematic-gradient lg:flex-row">
      <WorkspaceSidebar projectId={projectId} />
      <div className="flex flex-1 flex-col min-w-0">
        <WorkspaceTopbar projectId={projectId} />
        <main className="flex-1 overflow-auto p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
