import { BasicUserWorkflowPage } from "@/app/basic-users/workflow-page";

export const dynamic = "force-dynamic";

export default async function BasicUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BasicUserWorkflowPage id={id} />;
}
