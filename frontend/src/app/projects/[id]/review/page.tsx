import { ReviewStudio } from "@/features/review/ReviewStudio";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReviewStudio projectId={id} />;
}
