export type EndpointParamType = "string" | "number" | "boolean";
export type MalformedResponseMode = "invalid_json" | "wrong_content_type" | "empty_body";
export type FailureMode = "none" | "delay" | "error" | MalformedResponseMode;
export type CaseErrorMode = "none" | "error" | "protocol_error";
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type McpInputSchema = {
  type: "object";
  properties: Record<
    string,
    {
      type: EndpointParamType;
      title?: string;
      description?: string;
      default?: JsonValue;
    }
  >;
  required: string[];
  additionalProperties: false;
};

export type EndpointParamInput = {
  name: string;
  label?: string;
  description?: string;
  type: EndpointParamType;
  required: boolean;
  defaultValueJson?: string | null;
};

export type ResponseCaseInput = {
  name: string;
  priority: number;
  matchArgsJson: string;
  responseJson: string;
  statusCode: number;
  delayMs: number;
  errorMode: CaseErrorMode;
  errorStatusCode?: number | null;
  errorMessage?: string | null;
  errorBodyJson?: string | null;
  isDefault: boolean;
};

export type EndpointInput = {
  name: string;
  title?: string;
  description?: string;
  enabled: boolean;
  deleteCode?: string | null;
  defaultResponseJson: string;
  failureMode: FailureMode;
  failureStatusCode?: number | null;
  failureDelayMs: number;
  failureMessage?: string | null;
  malformedResponseJson?: string | null;
  parameters: EndpointParamInput[];
  responseCases: ResponseCaseInput[];
};

export type EndpointSummary = {
  id: string;
  name: string;
  title: string;
  description: string;
  enabled: boolean;
  protectedDefault: boolean;
  parameterCount: number;
  responseCaseCount: number;
  updatedAt: string;
};

export type EndpointDetail = EndpointSummary & {
  deleteCode: string | null;
  defaultResponseJson: string;
  inputSchema: McpInputSchema;
  failureMode: FailureMode;
  failureStatusCode: number | null;
  failureDelayMs: number;
  failureMessage: string | null;
  malformedResponseJson: string | null;
  parameters: Array<EndpointParamInput & { id: string; position: number }>;
  responseCases: Array<ResponseCaseInput & { id: string }>;
};

export type EndpointListResult = {
  total: number;
  enabled: number;
  disabled: number;
  endpoints: EndpointSummary[];
};

export type EndpointMcpTool = {
  name: string;
  description: string;
  inputSchema: McpInputSchema;
};

export type EndpointRestToolParameter = {
  name: string;
  label: string;
  description: string;
  type: EndpointParamType;
  required: boolean;
  defaultValue?: JsonValue;
};

export type EndpointRestTool = {
  name: string;
  title: string;
  description: string;
  parameters: EndpointRestToolParameter[];
};

export type EndpointRestToolListResult = {
  tools: EndpointRestTool[];
};

export type EndpointDeleteInput = {
  deleteCode?: string | null;
  rootPassword?: string | null;
};

export class EndpointValidationError extends Error {
  constructor(public readonly fieldErrors: Record<string, string>) {
    super("Endpoint validation failed");
  }
}

export class EndpointDeleteAuthorizationError extends Error {
  constructor(public readonly reason: "missing_confirmation" | "invalid_confirmation" | "protected_default") {
    super("Endpoint delete authorization failed");
  }
}

export class EndpointNotFoundError extends Error {
  constructor() {
    super("Endpoint not found");
  }
}
