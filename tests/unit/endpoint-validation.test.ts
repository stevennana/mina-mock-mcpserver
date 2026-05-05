import assert from "node:assert/strict";
import test from "node:test";
import { EndpointValidationError } from "@/lib/endpoints/types";
import type { EndpointInput } from "@/lib/endpoints/types";
import { generateMcpInputSchema } from "@/lib/endpoints/schema";
import { validateEndpointInput } from "@/lib/endpoints/validation";

function validEndpoint(overrides: Partial<EndpointInput> = {}): EndpointInput {
  return {
    name: "weather_lookup",
    title: "Weather lookup",
    description: "Returns deterministic weather data.",
    enabled: true,
    deleteCode: "12345678",
    defaultResponseJson: JSON.stringify({ ok: true }),
    failureMode: "none",
    failureStatusCode: null,
    failureDelayMs: 0,
    failureMessage: null,
    malformedResponseJson: null,
    parameters: [
      {
        name: "city",
        label: "City",
        description: "City name",
        type: "string",
        required: true,
        defaultValueJson: null,
      },
    ],
    responseCases: [
      {
        name: "default",
        priority: 0,
        matchArgsJson: "{}",
        responseJson: JSON.stringify({ ok: true }),
        statusCode: 200,
        delayMs: 0,
        errorMode: "none",
        errorStatusCode: null,
        errorMessage: null,
        errorBodyJson: null,
        isDefault: true,
      },
    ],
    ...overrides,
  };
}

test("endpoint validation accepts the MVP editor field set", () => {
  const input = validEndpoint({
    failureMode: "delay",
    failureDelayMs: 125,
    responseCases: [
      ...validEndpoint().responseCases,
      {
        name: "seattle",
        priority: 10,
        matchArgsJson: JSON.stringify({ city: "Seattle" }),
        responseJson: JSON.stringify({ temp: 62 }),
        statusCode: 200,
        delayMs: 10,
        errorMode: "none",
        errorStatusCode: null,
        errorMessage: null,
        errorBodyJson: null,
        isDefault: false,
      },
    ],
  });

  assert.equal(validateEndpointInput(input).name, "weather_lookup");
});

test("endpoint validation returns field-level errors for UI rendering", () => {
  assert.throws(
    () =>
      validateEndpointInput(
        validEndpoint({
          name: "bad name",
          deleteCode: "abc",
          defaultResponseJson: "{",
          parameters: [
            { name: "city", label: "", description: "", type: "string", required: false, defaultValueJson: null },
            { name: "city", label: "", description: "", type: "string", required: false, defaultValueJson: null },
            { name: "extra_one", label: "", description: "", type: "string", required: false, defaultValueJson: null },
            { name: "extra_two", label: "", description: "", type: "string", required: false, defaultValueJson: null },
          ],
          responseCases: [{ ...validEndpoint().responseCases[0], isDefault: false }],
        }),
      ),
    (error) => {
      assert.equal(error instanceof EndpointValidationError, true);
      const fieldErrors = (error as EndpointValidationError).fieldErrors;
      assert.match(fieldErrors.name, /letters/);
      assert.match(fieldErrors.deleteCode, /8 digits/);
      assert.match(fieldErrors.defaultResponseJson, /valid JSON/);
      assert.match(fieldErrors.parameters, /three/);
      assert.match(fieldErrors["parameters.1.name"], /unique/);
      assert.match(fieldErrors["responseCases.default"], /exactly one/);
      return true;
    },
  );
});

test("MCP input schema generation reflects endpoint parameters", () => {
  const schema = generateMcpInputSchema({
    parameters: [
      {
        name: "city",
        label: "City",
        description: "City to look up.",
        type: "string",
        required: true,
        defaultValueJson: '"Seoul"',
      },
      {
        name: "units",
        label: "",
        description: "",
        type: "number",
        required: false,
        defaultValueJson: "1",
      },
    ],
  });

  assert.deepEqual(schema, {
    type: "object",
    properties: {
      city: {
        type: "string",
        title: "City",
        description: "City to look up.",
        default: "Seoul",
      },
      units: {
        type: "number",
        default: 1,
      },
    },
    required: ["city"],
    additionalProperties: false,
  });
});
