import { ResourceWorkflowPage } from "@/app/resources/workflow-page";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function DeleteResourcePage({ params }: PageProps) {
  const { id } = await params;
  return <ResourceWorkflowPage view="delete" id={id} />;
}
