import { SlideEditorWorkspace } from "@/features/editor/SlideEditorWorkspace";
import { SetupWizardProvider } from "@/features/setup/SetupWizardContext";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <SetupWizardProvider projectId={id}>
      <SlideEditorWorkspace projectId={id} />
    </SetupWizardProvider>
  );
}
