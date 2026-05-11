import { OAuthClientWorkflowPage } from "@/app/oauth-clients/workflow-page";

export const dynamic = "force-dynamic";

export default async function OAuthClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OAuthClientWorkflowPage id={id} />;
}
