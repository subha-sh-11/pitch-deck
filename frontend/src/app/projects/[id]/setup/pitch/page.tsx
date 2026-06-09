import { redirect } from "next/navigation";

// The three-step wizard is replaced by the conversational intake on /setup/identity.
export default async function PitchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/projects/${id}/setup/identity`);
}
