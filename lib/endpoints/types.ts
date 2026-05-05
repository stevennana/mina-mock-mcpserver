export type EndpointParamType = "string" | "number" | "boolean";
export type FailureMode = "none" | "delay" | "error" | "malformed";
export type CaseErrorMode = "none" | "error";

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

export class EndpointValidationError extends Error {
  constructor(public readonly fieldErrors: Record<string, string>) {
    super("Endpoint validation failed");
  }
}
