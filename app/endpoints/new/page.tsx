import { EndpointWorkflowPage } from "@/app/endpoints/workflow-page";

export const dynamic = "force-dynamic";

export default function NewEndpointPage() {
  return <EndpointWorkflowPage view="create" />;
}
