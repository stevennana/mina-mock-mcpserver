import { PromptWorkflowPage } from "@/app/prompts/workflow-page";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PromptCompletionPage({ params }: PageProps) {
  const { id } = await params;
  return <PromptWorkflowPage view="completion" id={id} />;
}
