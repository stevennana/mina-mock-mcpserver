import { ResourceTemplateWorkflowPage } from "@/app/resource-templates/workflow-page";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ResourceTemplateCompletionPage({ params }: PageProps) {
  const { id } = await params;
  return <ResourceTemplateWorkflowPage view="completion" id={id} />;
}
