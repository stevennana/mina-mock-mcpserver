async function main() {
  const input = await new Promise<string>((resolve, reject) => {
    let body = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      body += chunk;
    });
    process.stdin.on("end", () => resolve(body));
    process.stdin.on("error", reject);
  });

  const payload = JSON.parse(input) as {
    url: string;
    method: string;
    headers: [string, string][];
    body: string | null;
  };

  const httpModule = await import("../lib/mcp/http");
  const httpExports = (
    "default" in httpModule ? httpModule.default : httpModule
  ) as typeof import("../lib/mcp/http");
  const { handleNoAuthMcpPost } = httpExports;

  const request = new Request(payload.url, {
    method: payload.method,
    headers: payload.headers,
    body: payload.body,
  });
  const response = await handleNoAuthMcpPost(request);
  const responseHeaders: [string, string][] = [];
  response.headers.forEach((value, key) => {
    responseHeaders.push([key, value]);
  });

  process.stdout.write(
    JSON.stringify({
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: await response.text(),
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
