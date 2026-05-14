import { ResourceWorkflowPage } from "@/app/resources/workflow-page";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ResourceContentPage({ params }: PageProps) {
  const { id } = await params;
  return <ResourceWorkflowPage view="content" id={id} />;
}
