export const PUBLIC_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": [
    "Accept",
    "Authorization",
    "Content-Type",
    "Last-Event-ID",
    "MCP-Protocol-Version",
    "MCP-Session-Id",
  ].join(", "),
  "Access-Control-Expose-Headers": [
    "MCP-Protocol-Version",
    "MCP-Session-Id",
    "WWW-Authenticate",
    "X-MCP-Mock-Matched-Case",
    "X-MCP-Mock-Malformed-Mode",
    "X-MCP-Mock-Principal",
  ].join(", "),
  "Access-Control-Max-Age": "86400",
};

export function publicCorsHeaders(headers: Record<string, string> = {}) {
  return {
    ...PUBLIC_CORS_HEADERS,
    ...headers,
  };
}

export function publicCorsOptionsResponse() {
  return new Response(null, {
    status: 204,
    headers: publicCorsHeaders(),
  });
}
