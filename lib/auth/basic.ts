import type { PrismaClient } from "@prisma/client";
import { verifyBasicCredentials } from "@/lib/basic-auth/service";
import type { BasicUserSummary } from "@/lib/basic-auth/types";

export type ParsedBasicAuthorization =
  | { kind: "missing" }
  | { kind: "basic"; username: string; password: string }
  | { kind: "invalid"; reason: "malformed" }
  | { kind: "unsupported"; scheme: string };

export type BasicAuthorizationResolution =
  | { kind: "missing" }
  | { kind: "authenticated"; principal: BasicUserSummary }
  | { kind: "unauthorized"; reason: "invalid" | "unsupported" };

function decodeBasicCredentials(encoded: string) {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 === 1) {
    return null;
  }

  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex <= 0) {
      return null;
    }

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

export function parseBasicAuthorizationHeader(header: string | null): ParsedBasicAuthorization {
  if (!header) {
    return { kind: "missing" };
  }

  const match = header.match(/^(\S+)\s+(\S+)$/);
  if (!match) {
    return { kind: "invalid", reason: "malformed" };
  }

  const [, scheme, encoded] = match;
  if (scheme.toLowerCase() !== "basic") {
    return { kind: "unsupported", scheme };
  }

  const credentials = decodeBasicCredentials(encoded);
  return credentials ? { kind: "basic", ...credentials } : { kind: "invalid", reason: "malformed" };
}

export async function resolveBasicAuthorizationHeader(
  header: string | null,
  client?: PrismaClient,
): Promise<BasicAuthorizationResolution> {
  const parsed = parseBasicAuthorizationHeader(header);
  if (parsed.kind === "missing") {
    return { kind: "missing" };
  }
  if (parsed.kind === "invalid" || parsed.kind === "unsupported") {
    return { kind: "unauthorized", reason: parsed.kind };
  }

  const principal = await verifyBasicCredentials(parsed.username, parsed.password, client);
  return principal ? { kind: "authenticated", principal } : { kind: "unauthorized", reason: "invalid" };
}
