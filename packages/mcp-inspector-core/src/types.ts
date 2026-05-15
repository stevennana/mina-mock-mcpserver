export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export type McpTransport = "http" | "sse";

export type HeaderInput = Record<string, string> | string[];

export type AuthorizationOptions = {
  headers?: HeaderInput;
  basic?: string | { username: string; password: string };
  bearer?: string;
};

export type BuildMcpRequestOptions = {
  family: "tools" | "resources" | "prompts" | "completion" | "raw";
  action: string;
  id?: string | number | null;
  name?: string;
  uri?: string;
  method?: string;
  args?: JsonObject;
  params?: JsonObject;
  argument?: { name: string; value?: string };
  refType?: "prompt" | "resource";
};

export type InspectionStep = {
  name: string;
  status: "pass" | "warn" | "fail" | "skip";
  request?: {
    url: string;
    headers?: Record<string, string>;
    body?: unknown;
  };
  response?: {
    status: number;
    ok: boolean;
    elapsedMs: number;
    headers: Record<string, string>;
    body: unknown;
  };
  evidence?: string;
};

export type InspectionResult = {
  ok: boolean;
  targetUrl: string;
  transport: McpTransport;
  steps: InspectionStep[];
  diagnostics: Array<[string, string | number | boolean]>;
  result?: unknown;
  raw?: unknown;
  summary: {
    pass: number;
    warn: number;
    skip: number;
    fail: number;
  };
};

export type InspectMcpTargetOptions = {
  url: string;
  transport?: McpTransport;
  method: string;
  params?: JsonObject;
  headers?: HeaderInput;
  protocolVersion?: string;
  insecureTls?: boolean;
  initialize?: boolean;
  includeProtocolProbe?: boolean;
  clientInfo?: {
    name: string;
    version: string;
  };
};
