import { OAuthUserWorkflowPage } from "@/app/oauth-users/workflow-page";

export default async function OAuthUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OAuthUserWorkflowPage id={id} />;
}
