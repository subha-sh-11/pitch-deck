import { SetupWizardLayout } from "@/features/setup/SetupWizardLayout";

export default async function SetupLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SetupWizardLayout projectId={id}>{children}</SetupWizardLayout>;
}
