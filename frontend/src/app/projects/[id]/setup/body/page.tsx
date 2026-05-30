import { BodyStep } from "@/features/setup/BodyStep";

export default async function BodyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BodyStep projectId={id} />;
}
