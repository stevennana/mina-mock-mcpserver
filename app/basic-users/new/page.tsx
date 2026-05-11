import { BasicUserWorkflowPage } from "@/app/basic-users/workflow-page";

export const dynamic = "force-dynamic";

export default function NewBasicUserPage() {
  return <BasicUserWorkflowPage create />;
}
