import { redirect } from "next/navigation";
import { projectRoutes } from "@/lib/routes";

export default async function DesignRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(projectRoutes.templates(id));
}
