import { ResourceWorkflowPage } from "@/app/resources/workflow-page";

export const dynamic = "force-dynamic";

export default function NewResourcePage() {
  return <ResourceWorkflowPage view="create" />;
}
