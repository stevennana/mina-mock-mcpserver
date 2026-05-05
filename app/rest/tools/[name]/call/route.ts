import {
  handleRestToolCallPost,
  unsupportedRestToolsMethod,
} from "@/lib/rest/http";

type RouteContext = {
  params: Promise<{ name: string }>;
};

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext) {
  const { name } = await context.params;
  return handleRestToolCallPost(request, name);
}

export const DELETE = unsupportedRestToolsMethod;
export const GET = unsupportedRestToolsMethod;
export const PATCH = unsupportedRestToolsMethod;
export const PUT = unsupportedRestToolsMethod;
