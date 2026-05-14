import { ResourceWorkflowPage } from "@/app/resources/workflow-page";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ResourceConsolePage({ params }: PageProps) {
  const { id } = await params;
  return <ResourceWorkflowPage view="console" id={id} />;
}
