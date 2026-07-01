import { ExportStudio } from "@/features/export/ExportStudio";

export default async function ExportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ExportStudio projectId={id} />;
}
