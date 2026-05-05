import { NextResponse } from "next/server";
import { endpointErrorResponse, endpointInputFromBody } from "@/lib/endpoints/api";
import { getEndpoint, updateEndpoint } from "@/lib/endpoints/service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const endpoint = await getEndpoint(id);
    if (!endpoint) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ endpoint });
  } catch (error) {
    return endpointErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const endpoint = await updateEndpoint(id, endpointInputFromBody(await request.json()));
    return NextResponse.json({ endpoint });
  } catch (error) {
    return endpointErrorResponse(error);
  }
}
