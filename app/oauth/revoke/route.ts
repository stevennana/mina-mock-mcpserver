import { NextResponse } from "next/server";
import { publicCorsHeaders, publicCorsOptionsResponse } from "@/lib/http/cors";
import {
  revokeOAuthIssuedTokenForClient,
  verifyOAuthClientSecret,
} from "@/lib/oauth/service";

function readBasicClientCredentials(header: string | null) {
  if (!header?.toLowerCase().startsWith("basic ")) return null;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return {
      clientId: decoded.slice(0, separator),
      clientSecret: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

function jwtJti(token: string) {
  const [, payload] = token.split(".");
  if (!payload) return token;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown;
    if (parsed && typeof parsed === "object" && "jti" in parsed && typeof parsed.jti === "string") {
      return parsed.jti;
    }
  } catch {
    return token;
  }
  return token;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const token = String(formData.get("token") ?? "").trim();
  const basic = readBasicClientCredentials(request.headers.get("Authorization"));
  const clientId = basic?.clientId || String(formData.get("client_id") ?? "").trim();
  const clientSecret = basic?.clientSecret ?? String(formData.get("client_secret") ?? "");

  if (!token) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "token is required." },
      { status: 400, headers: publicCorsHeaders() },
    );
  }

  const client = clientId && clientSecret ? await verifyOAuthClientSecret(clientId, clientSecret) : null;
  if (!client) {
    return NextResponse.json(
      { error: "invalid_client", error_description: "OAuth client is invalid." },
      {
        status: 401,
        headers: publicCorsHeaders({ "WWW-Authenticate": 'Basic realm="oauth-revoke"' }),
      },
    );
  }

  await revokeOAuthIssuedTokenForClient({ jti: jwtJti(token), clientId });
  return new Response(null, {
    status: 200,
    headers: publicCorsHeaders({ "Cache-Control": "no-store", Pragma: "no-cache" }),
  });
}

export const OPTIONS = publicCorsOptionsResponse;
