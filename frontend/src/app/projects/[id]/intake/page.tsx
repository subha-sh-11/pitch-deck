import { redirect } from "next/navigation";
import { projectRoutes } from "@/lib/routes";

export default async function IntakeRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(projectRoutes.setupIdentity(id));
}
