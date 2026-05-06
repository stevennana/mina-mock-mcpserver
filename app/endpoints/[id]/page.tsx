import { EndpointWorkflowPage } from "@/app/endpoints/workflow-page";

export default async function EndpointOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EndpointWorkflowPage id={id} view="overview" />;
}
