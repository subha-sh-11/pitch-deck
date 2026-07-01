"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { isAuthenticated } from "@/lib/api";
import { projectRoutes } from "@/lib/routes";

/**
 * Client-side gate for authenticated areas. Redirects to the auth page when there's no
 * token, and renders nothing until we've confirmed the user is signed in. Apply it via a
 * route-group layout so every page underneath is protected in one place.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    if (isAuthenticated()) {
      setAuthed(true);
    } else {
      setAuthed(false);
      router.replace(projectRoutes.signup());
    }
  }, [router]);

  if (authed !== true) return null; // nothing renders while unauthenticated / redirecting
  return <>{children}</>;
}
