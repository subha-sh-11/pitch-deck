import { TemplateGallery } from "@/features/templates/TemplateGallery";
import { TemplatesPageShell } from "@/features/templates/TemplatesPageShell";

export default async function TemplatesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <TemplatesPageShell projectId={id}>
      <TemplateGallery projectId={id} />
    </TemplatesPageShell>
  );
}
