import { NextResponse } from "next/server";
import { endpointDeleteInputFromBody, endpointErrorResponse, endpointInputFromBody } from "@/lib/endpoints/api";
import { deleteEndpoint, getEndpoint, updateEndpoint } from "@/lib/endpoints/service";

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
    return NextResponse.json({ endpoint }, { headers: { "cache-control": "no-store" } });
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

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const deletedEndpoint = await deleteEndpoint(id, endpointDeleteInputFromBody(await request.json()));
    return NextResponse.json({ endpoint: deletedEndpoint });
  } catch (error) {
    return endpointErrorResponse(error);
  }
}
