import { PitchStep } from "@/features/setup/PitchStep";

export default async function PitchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PitchStep projectId={id} />;
}
