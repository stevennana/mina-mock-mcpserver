import type { EndpointInput, EndpointParamInput, JsonValue, McpInputSchema } from "@/lib/endpoints/types";

function parseDefaultValue(value: string | null | undefined): JsonValue | undefined {
  if (!value?.trim()) return undefined;
  return JSON.parse(value) as JsonValue;
}

export function generateMcpInputSchema(endpoint: Pick<EndpointInput, "parameters">): McpInputSchema {
  const properties: McpInputSchema["properties"] = {};
  const required: string[] = [];

  endpoint.parameters.forEach((parameter: EndpointParamInput) => {
    const name = parameter.name.trim();
    if (!name) return;

    const property: McpInputSchema["properties"][string] = {
      type: parameter.type,
    };

    const title = parameter.label?.trim();
    const description = parameter.description?.trim();
    const defaultValue = parseDefaultValue(parameter.defaultValueJson);

    if (title) property.title = title;
    if (description) property.description = description;
    if (defaultValue !== undefined) property.default = defaultValue;
    if (parameter.required) required.push(name);

    properties[name] = property;
  });

  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}
