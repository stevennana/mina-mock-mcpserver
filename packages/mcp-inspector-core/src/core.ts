import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { performance } from "node:perf_hooks";
import { Buffer } from "node:buffer";
import type {
  AuthorizationOptions,
  BuildMcpRequestOptions,
  HeaderInput,
  InspectMcpTargetOptions,
  InspectionResult,
  InspectionStep,
  JsonObject,
  JsonValue,
} from "./types.js";

const DEFAULT_PROTOCOL_VERSION = "2025-06-18";

type FetchEvidence = NonNullable<InspectionStep["response"]>;
type JsonRpcPayload = {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: JsonObject;
};

export function parseJsonObject(value: string | undefined, label = "JSON value"): JsonObject {
  if (!value || !value.trim()) return {};
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return parsed as JsonObject;
}

export function parseKeyValueArgs(values: string[] = []): JsonObject {
  const parsed: JsonObject = {};
  for (const value of values) {
    const separator = value.indexOf("=");
    if (separator <= 0) {
      throw new Error(`Argument must use key=value syntax: ${value}`);
    }
    const key = value.slice(0, separator).trim();
    const rawValue = value.slice(separator + 1);
    if (!key) throw new Error(`Argument key is empty: ${value}`);
    parsed[key] = parseScalar(rawValue);
  }
  return parsed;
}

export function parseHeaderLines(values: string[] = []): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const value of values) {
    const separator = value.indexOf(":");
    if (separator <= 0) {
      throw new Error(`Header must use "Name: Value" syntax: ${value}`);
    }
    parsed[value.slice(0, separator).trim()] = value.slice(separator + 1).trim();
  }
  return parsed;
}

export function createAuthorizationHeaders(options: AuthorizationOptions = {}): Record<string, string> {
  const headers = normalizeHeaderInput(options.headers);
  if (options.basic && options.bearer) {
    throw new Error("Use either Basic auth or Bearer auth, not both.");
  }
  if (options.basic) {
    const credentials = typeof options.basic === "string"
      ? options.basic
      : `${options.basic.username}:${options.basic.password}`;
    headers.Authorization = `Basic ${Buffer.from(credentials, "utf8").toString("base64")}`;
  }
  if (options.bearer) {
    headers.Authorization = `Bearer ${options.bearer}`;
  }
  return headers;
}

export function redactHeaders(headers: Record<string, string> = {}): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      /authorization|cookie|token|secret|api[-_]?key/i.test(key) ? "<redacted>" : value,
    ]),
  );
}

export function buildMcpRequest(options: BuildMcpRequestOptions): JsonRpcPayload {
  const id = options.id ?? `mmcp-${options.family}-${options.action}`;
  if (options.family === "raw") {
    if (!options.method) throw new Error("raw commands require method.");
    return {
      jsonrpc: "2.0",
      id,
      method: options.method,
      ...(options.params && Object.keys(options.params).length ? { params: options.params } : {}),
    };
  }

  if (options.family === "tools" && options.action === "list") {
    return { jsonrpc: "2.0", id, method: "tools/list" };
  }
  if (options.family === "tools" && options.action === "call") {
    if (!options.name) throw new Error("tools call requires --name.");
    return {
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name: options.name, arguments: options.args ?? {} },
    };
  }

  if (options.family === "resources" && options.action === "list") {
    return { jsonrpc: "2.0", id, method: "resources/list" };
  }
  if (options.family === "resources" && options.action === "read") {
    if (!options.uri) throw new Error("resources read requires --uri.");
    return { jsonrpc: "2.0", id, method: "resources/read", params: { uri: options.uri } };
  }
  if (options.family === "resources" && options.action === "templates") {
    return { jsonrpc: "2.0", id, method: "resources/templates/list" };
  }

  if (options.family === "prompts" && options.action === "list") {
    return { jsonrpc: "2.0", id, method: "prompts/list" };
  }
  if (options.family === "prompts" && options.action === "get") {
    if (!options.name) throw new Error("prompts get requires --name.");
    return {
      jsonrpc: "2.0",
      id,
      method: "prompts/get",
      params: { name: options.name, arguments: options.args ?? {} },
    };
  }

  if (options.family === "completion" && (options.action === "prompt" || options.action === "resource")) {
    if (!options.argument?.name) throw new Error("completion requires --argument name=value.");
    const ref: JsonObject = options.action === "prompt"
      ? { type: "ref/prompt", name: options.name ?? "" }
      : { type: "ref/resource", uri: options.uri ?? "" };
    return {
      jsonrpc: "2.0",
      id,
      method: "completion/complete",
      params: { ref, argument: options.argument },
    };
  }

  throw new Error(`Unsupported MCP command: ${options.family} ${options.action}`);
}

export async function inspectMcpTarget(options: InspectMcpTargetOptions): Promise<InspectionResult> {
  const targetUrl = normalizeTargetUrl(options.url);
  const transport = options.transport ?? "http";
  const protocolVersion = options.protocolVersion ?? DEFAULT_PROTOCOL_VERSION;
  const headers = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    ...normalizeHeaderInput(options.headers),
  };
  const protocolHeaders = { ...headers, "MCP-Protocol-Version": protocolVersion };
  const steps: InspectionStep[] = [];
  const diagnostics: Array<[string, string | number | boolean]> = [
    ["transport", transport],
    ["tls verification", options.insecureTls ? "self-signed allowed" : "default"],
  ];

  const sender = transport === "sse"
    ? await createSseSender(targetUrl, headers, Boolean(options.insecureTls))
    : null;

  const send = async (payload: JsonRpcPayload, requestHeaders: Record<string, string>) => {
    if (sender) return sender.send(payload, requestHeaders);
    return postJson(targetUrl, payload, requestHeaders, Boolean(options.insecureTls));
  };

  if (options.initialize !== false) {
    const initializePayload: JsonRpcPayload = {
      jsonrpc: "2.0",
      id: "inspector-initialize",
      method: "initialize",
      params: {
        protocolVersion,
        capabilities: {},
        clientInfo: options.clientInfo ?? { name: "mina-mcp-inspector-core", version: "0.1.0" },
      },
    };
    const initialize = await send(initializePayload, headers);
    steps.push(makeStep("MCP initialize", initialize.ok ? "pass" : "fail", {
      request: { url: targetUrl, headers: redactHeaders(headers), body: initializePayload },
      response: initialize,
    }));
    diagnostics.push(["initialize status", initialize.status]);
    diagnostics.push([
      "negotiated protocol",
        String(readPath(initialize.body, ["result", "protocolVersion"])
        ?? initialize.headers["mcp-protocol-version"]
        ?? "not reported"),
    ]);
  }

  const payload: JsonRpcPayload = {
    jsonrpc: "2.0",
    id: `inspector-${options.method.replaceAll("/", "-")}`,
    method: options.method,
    ...(options.params && Object.keys(options.params).length ? { params: options.params } : {}),
  };
  const methodResult = await send(payload, protocolHeaders);
  const hasResultOrJsonRpcError = Boolean(
    readPath(methodResult.body, ["result"]) !== undefined || readPath(methodResult.body, ["error"]) !== undefined,
  );
  steps.push(makeStep(`MCP ${options.method}`, methodResult.ok && hasResultOrJsonRpcError ? "pass" : "fail", {
    request: { url: targetUrl, headers: redactHeaders(protocolHeaders), body: payload },
    response: methodResult,
  }));
  diagnostics.push(["method", options.method]);
  diagnostics.push(["response protocol header", methodResult.headers["mcp-protocol-version"] ?? "not reported"]);

  if (options.includeProtocolProbe) {
    const badVersionPayload = buildMcpRequest({ family: "tools", action: "list", id: "inspector-bad-version" });
    const badVersionHeaders = { ...headers, "MCP-Protocol-Version": "1900-01-01" };
    const badVersion = await send(badVersionPayload, badVersionHeaders);
    const status = badVersion.status >= 400 ? "pass" : "warn";
    steps.push(makeStep("Unsupported protocol-version probe", status, {
      request: { url: targetUrl, headers: redactHeaders(badVersionHeaders), body: badVersionPayload },
      response: badVersion,
      evidence: status === "pass"
        ? "Target rejects an intentionally unsupported protocol version."
        : "Target accepted the unsupported probe; this may be allowed by that server.",
    }));
  }

  sender?.close();
  return summarize({
    ok: steps.every((step) => step.status !== "fail"),
    targetUrl,
    transport,
    steps,
    diagnostics,
    result: methodResult.body,
    raw: methodResult,
    summary: { pass: 0, warn: 0, skip: 0, fail: 0 },
  });
}

function normalizeHeaderInput(input: HeaderInput | undefined): Record<string, string> {
  if (!input) return {};
  if (Array.isArray(input)) return parseHeaderLines(input);
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, String(value)]));
}

function parseScalar(value: string): JsonValue {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function normalizeTargetUrl(value: string): string {
  const targetUrl = String(value ?? "").trim();
  if (!targetUrl) throw new Error("MCP endpoint URL is required.");
  const url = new URL(targetUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("MCP endpoint URL must be http or https.");
  }
  return url.toString();
}

function makeStep(
  name: string,
  status: InspectionStep["status"],
  data: Omit<InspectionStep, "name" | "status">,
): InspectionStep {
  return { name, status, ...data };
}

function summarize(result: InspectionResult): InspectionResult {
  const summary = {
    pass: result.steps.filter((step) => step.status === "pass").length,
    warn: result.steps.filter((step) => step.status === "warn").length,
    skip: result.steps.filter((step) => step.status === "skip").length,
    fail: result.steps.filter((step) => step.status === "fail").length,
  };
  return { ...result, ok: summary.fail === 0, summary };
}

function readPath(value: unknown, path: string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

async function postJson(
  url: string,
  payload: JsonRpcPayload,
  headers: Record<string, string>,
  insecureTls: boolean,
): Promise<FetchEvidence> {
  const startedAt = performance.now();
  const response = insecureTls && url.startsWith("https:")
    ? await nodeRequest("POST", url, headers, JSON.stringify(payload), true)
    : await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
  const elapsedMs = Math.round(performance.now() - startedAt);
  const responseHeaders = Object.fromEntries(response.headers.entries());
  const text = await response.text();
  return {
    status: response.status,
    ok: response.ok,
    elapsedMs,
    headers: responseHeaders,
    body: parseResponseBody(text, responseHeaders["content-type"] ?? ""),
  };
}

function parseResponseBody(text: string, contentType: string): unknown {
  if (!text) return "";
  if (contentType.includes("application/json")) return JSON.parse(text);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function nodeRequest(
  method: "POST" | "GET",
  url: string,
  headers: Record<string, string>,
  body: string | undefined,
  insecureTls: boolean,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === "https:" ? httpsRequest : httpRequest;
    const request = transport({
      method,
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port,
      path: `${parsed.pathname}${parsed.search}`,
      headers,
      rejectUnauthorized: insecureTls ? false : undefined,
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () => {
        const responseHeaders = new Headers();
        for (const [key, value] of Object.entries(response.headers)) {
          if (Array.isArray(value)) responseHeaders.set(key, value.join(", "));
          else if (value !== undefined) responseHeaders.set(key, value);
        }
        resolve(new Response(Buffer.concat(chunks), {
          status: response.statusCode ?? 0,
          headers: responseHeaders,
        }));
      });
    });
    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
}

async function createSseSender(
  url: string,
  headers: Record<string, string>,
  insecureTls: boolean,
): Promise<{ send(payload: JsonRpcPayload, requestHeaders: Record<string, string>): Promise<FetchEvidence>; close(): void }> {
  if (insecureTls && url.startsWith("https:")) {
    throw new Error("Legacy SSE with --insecure-tls is not supported by the inspector core yet.");
  }
  const response = await fetch(url, { method: "GET", headers: { ...headers, accept: "text/event-stream" } });
  if (!response.ok || !response.body) {
    throw new Error(`SSE connection failed with HTTP ${response.status}.`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let closed = false;

  const readEvent = async (expectedEvent?: string): Promise<{ event: string; data: string }> => {
    const deadline = Date.now() + 7000;
    while (Date.now() < deadline) {
      const event = takeEventFromBuffer();
      if (event && (!expectedEvent || event.event === expectedEvent)) return event;
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
    }
    throw new Error(`Timed out waiting for SSE ${expectedEvent ?? "event"}.`);
  };

  const takeEventFromBuffer = (): { event: string; data: string } | null => {
    const normalized = buffer.replaceAll("\r\n", "\n");
    const boundary = normalized.indexOf("\n\n");
    if (boundary < 0) return null;
    const rawEvent = normalized.slice(0, boundary);
    buffer = normalized.slice(boundary + 2);
    const lines = rawEvent.split("\n");
    let event = "message";
    const data: string[] = [];
    for (const line of lines) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
    }
    return { event, data: data.join("\n") };
  };

  const endpoint = await readEvent("endpoint");
  const messageUrl = new URL(endpoint.data, url).toString();

  return {
    async send(payload, requestHeaders) {
      const startedAt = performance.now();
      const post = await fetch(messageUrl, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify(payload),
      });
      if (!post.ok) {
        const elapsedMs = Math.round(performance.now() - startedAt);
        const text = await post.text();
        return {
          status: post.status,
          ok: false,
          elapsedMs,
          headers: Object.fromEntries(post.headers.entries()),
          body: parseResponseBody(text, post.headers.get("content-type") ?? ""),
        };
      }
      const message = await readEvent("message");
      const elapsedMs = Math.round(performance.now() - startedAt);
      return {
        status: post.status,
        ok: post.ok,
        elapsedMs,
        headers: Object.fromEntries(post.headers.entries()),
        body: parseResponseBody(message.data, "application/json"),
      };
    },
    close() {
      if (!closed) {
        closed = true;
        void reader.cancel();
      }
    },
  };
}
