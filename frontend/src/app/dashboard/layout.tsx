import type { ReactNode } from "react";
import { AuthGuard } from "@/components/layout/AuthGuard";

// Gate the dashboard behind auth.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>;
}
