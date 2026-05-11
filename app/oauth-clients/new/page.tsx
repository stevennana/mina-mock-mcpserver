import { OAuthClientWorkflowPage } from "@/app/oauth-clients/workflow-page";

export const dynamic = "force-dynamic";

export default function NewOAuthClientPage() {
  return <OAuthClientWorkflowPage create />;
}
