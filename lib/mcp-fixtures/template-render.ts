import type { McpResourceTemplateArgumentInput } from "@/lib/mcp-fixtures/types";

const argumentNamePattern = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
const placeholderPattern = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

export type TemplateRenderResult = {
  ok: boolean;
  value: string;
  errors: string[];
  sampleValues: Record<string, string>;
};

export function extractTemplatePlaceholders(template: string) {
  const placeholders = new Set<string>();
  for (const match of template.matchAll(placeholderPattern)) {
    if (match[1]) {
      placeholders.add(match[1]);
    }
  }
  return [...placeholders];
}

function sampleValueFromJson(argument: McpResourceTemplateArgumentInput) {
  const raw = argument.sampleValueJson?.trim();
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "string") return parsed;
    if (typeof parsed === "number" || typeof parsed === "boolean") return String(parsed);
    return JSON.stringify(parsed);
  } catch {
    return raw;
  }
}

export function buildTemplateSampleValues(argumentsInput: McpResourceTemplateArgumentInput[]) {
  return Object.fromEntries(argumentsInput.map((argument) => [argument.name, sampleValueFromJson(argument)]));
}

export function renderValidatedTemplate(
  template: string,
  argumentsInput: McpResourceTemplateArgumentInput[],
  options: { encodeValues?: boolean } = {},
): TemplateRenderResult {
  const placeholders = extractTemplatePlaceholders(template);
  const placeholderSet = new Set(placeholders);
  const sampleValues = buildTemplateSampleValues(argumentsInput);
  const errors: string[] = [];
  const seen = new Set<string>();

  argumentsInput.forEach((argument) => {
    if (!argumentNamePattern.test(argument.name)) {
      errors.push(`${argument.name || "Unnamed argument"} is not a valid argument name.`);
    }
    if (seen.has(argument.name)) {
      errors.push(`${argument.name} is duplicated.`);
    }
    seen.add(argument.name);
    if (!placeholderSet.has(argument.name)) {
      errors.push(`${argument.name} is not present in the template.`);
    }
  });

  placeholders.forEach((placeholder) => {
    if (!seen.has(placeholder)) {
      errors.push(`${placeholder} has no matching argument.`);
    }
  });

  if (errors.length > 0) {
    return { ok: false, value: template, errors, sampleValues };
  }

  const value = template.replace(placeholderPattern, (_match, name: string) => {
    const sample = sampleValues[name] ?? "";
    return options.encodeValues ? encodeURIComponent(sample) : sample;
  });
  return { ok: true, value, errors: [], sampleValues };
}

export function renderTemplateWithValues(template: string, values: Record<string, string>, options: { encodeValues?: boolean } = {}) {
  return template.replace(placeholderPattern, (_match, name: string) => {
    const value = values[name] ?? "";
    return options.encodeValues ? encodeURIComponent(value) : value;
  });
}
