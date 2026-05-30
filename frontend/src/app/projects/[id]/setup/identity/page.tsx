import { IdentityStep } from "@/features/setup/IdentityStep";

export default async function IdentityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <IdentityStep projectId={id} />;
}
