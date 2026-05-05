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
