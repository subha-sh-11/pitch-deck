import { redirect } from "next/navigation";
import { projectRoutes } from "@/lib/routes";

// The deck lives in the Presentation tab of the intake studio — no standalone editor.
export default async function EditorRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(projectRoutes.setupIdentity(id));
}
