import { ResourceWorkflowPage } from "@/app/resources/workflow-page";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditResourcePage({ params }: PageProps) {
  const { id } = await params;
  return <ResourceWorkflowPage view="edit" id={id} />;
}
