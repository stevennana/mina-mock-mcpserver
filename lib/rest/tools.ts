import type { EndpointCallResult } from "@/lib/endpoints/runtime";
import type { EndpointParamInput, EndpointRestTool, JsonValue } from "@/lib/endpoints/types";

type RestToolEndpointInput = {
  name: string;
  title: string;
  description: string;
  parameters: EndpointParamInput[];
};

function parseDefaultValue(value: string | null | undefined): JsonValue | undefined {
  if (!value?.trim()) return undefined;
  return JSON.parse(value) as JsonValue;
}

export function restToolFromEndpoint(endpoint: RestToolEndpointInput): EndpointRestTool {
  return {
    name: endpoint.name,
    title: endpoint.title,
    description: endpoint.description,
    parameters: endpoint.parameters.map((parameter) => {
      const defaultValue = parseDefaultValue(parameter.defaultValueJson);
      return {
        name: parameter.name,
        label: parameter.label ?? "",
        description: parameter.description ?? "",
        type: parameter.type,
        required: parameter.required,
        ...(defaultValue !== undefined ? { defaultValue } : {}),
      };
    }),
  };
}

export type RestToolCallResponse = {
  status: number;
  body: JsonValue;
  matchedCase?: string;
};

export function restToolCallResponseFromEndpointCall(callResult: EndpointCallResult): RestToolCallResponse {
  if (callResult.kind === "matched") {
    return {
      status: callResult.statusCode,
      body: callResult.body,
      matchedCase: callResult.matchedCase.name,
    };
  }

  if (callResult.kind === "case_error") {
    return {
      status: callResult.statusCode,
      body:
        callResult.body ?? {
          error: "tool_error",
          message: callResult.message,
          matchedCase: callResult.matchedCase.name,
        },
      matchedCase: callResult.matchedCase.name,
    };
  }

  if (callResult.kind === "invalid_arguments") {
    return {
      status: 422,
      body: {
        error: "invalid_arguments",
        message: callResult.message,
      },
    };
  }

  return {
    status: 404,
    body: {
      error: "tool_not_found",
      message: "Tool was not found or is disabled.",
    },
  };
}
