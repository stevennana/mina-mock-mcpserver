import { NextResponse } from "next/server";
import { endpointErrorResponse, endpointInputFromBody } from "@/lib/endpoints/api";
import { createEndpoint, listEndpoints } from "@/lib/endpoints/service";

export async function GET() {
  try {
    return NextResponse.json(await listEndpoints(), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return endpointErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const endpoint = await createEndpoint(endpointInputFromBody(await request.json()));
    return NextResponse.json({ endpoint }, { status: 201 });
  } catch (error) {
    return endpointErrorResponse(error);
  }
}
