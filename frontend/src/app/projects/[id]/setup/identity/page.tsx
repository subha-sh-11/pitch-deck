import { IntakeStudio } from "@/features/setup/IntakeStudio";

export default async function IdentityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <IntakeStudio projectId={id} />;
}
