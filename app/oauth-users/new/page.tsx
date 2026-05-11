import { OAuthUserWorkflowPage } from "@/app/oauth-users/workflow-page";

export const dynamic = "force-dynamic";

export default function NewOAuthUserPage() {
  return <OAuthUserWorkflowPage create />;
}
