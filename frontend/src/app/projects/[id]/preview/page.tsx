import { SlideContentPreview } from "@/features/preview/SlideContentPreview";
import { PreviewPageShell } from "@/features/preview/PreviewPageShell";

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PreviewPageShell projectId={id}>
      <SlideContentPreview projectId={id} />
    </PreviewPageShell>
  );
}
