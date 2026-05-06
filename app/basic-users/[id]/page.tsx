import { BasicUserWorkflowPage } from "@/app/basic-users/workflow-page";

export default async function BasicUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BasicUserWorkflowPage id={id} />;
}
