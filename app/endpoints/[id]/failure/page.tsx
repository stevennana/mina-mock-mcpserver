import { EndpointWorkflowPage } from "@/app/endpoints/workflow-page";

export const dynamic = "force-dynamic";

export default async function EndpointFailurePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EndpointWorkflowPage id={id} view="failure" />;
}
