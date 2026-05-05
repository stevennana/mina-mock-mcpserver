import assert from "node:assert/strict";
import test from "node:test";
import { restToolCallResponseFromEndpointCall, restToolFromEndpoint } from "@/lib/rest/tools";

test("REST tool metadata maps endpoint parameters without MCP JSON-RPC envelope", () => {
  const tool = restToolFromEndpoint({
    name: "weather_lookup",
    title: "Weather lookup",
    description: "Returns deterministic weather data.",
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
        name: "metric",
        label: "",
        description: "",
        type: "boolean",
        required: false,
        defaultValueJson: "true",
      },
      {
        name: "days",
        label: "Days",
        description: "",
        type: "number",
        required: false,
        defaultValueJson: null,
      },
    ],
  });

  assert.deepEqual(tool, {
    name: "weather_lookup",
    title: "Weather lookup",
    description: "Returns deterministic weather data.",
    parameters: [
      {
        name: "city",
        label: "City",
        description: "City to look up.",
        type: "string",
        required: true,
        defaultValue: "Seoul",
      },
      {
        name: "metric",
        label: "",
        description: "",
        type: "boolean",
        required: false,
        defaultValue: true,
      },
      {
        name: "days",
        label: "Days",
        description: "",
        type: "number",
        required: false,
      },
    ],
  });
});

test("REST tool call mapper preserves success bodies and maps deterministic errors", () => {
  assert.deepEqual(
    restToolCallResponseFromEndpointCall({
      kind: "matched",
      matchedCase: { id: "case_seoul", name: "seoul", isDefault: false },
      body: { ok: true, city: "Seoul" },
      statusCode: 201,
      delayMs: 0,
    }),
    {
      status: 201,
      body: { ok: true, city: "Seoul" },
      matchedCase: "seoul",
    },
  );

  assert.deepEqual(
    restToolCallResponseFromEndpointCall({
      kind: "invalid_arguments",
      message: 'Argument "city" must be string.',
    }),
    {
      status: 422,
      body: {
        error: "invalid_arguments",
        message: 'Argument "city" must be string.',
      },
    },
  );

  assert.deepEqual(restToolCallResponseFromEndpointCall({ kind: "not_found" }), {
    status: 404,
    body: {
      error: "tool_not_found",
      message: "Tool was not found or is disabled.",
    },
  });

  assert.deepEqual(
    restToolCallResponseFromEndpointCall({
      kind: "case_error",
      matchedCase: { id: "case_error", name: "forced-error", isDefault: false },
      statusCode: 503,
      body: null,
      message: "Forced upstream outage.",
      delayMs: 0,
    }),
    {
      status: 503,
      body: {
        error: "tool_error",
        message: "Forced upstream outage.",
        matchedCase: "forced-error",
      },
      matchedCase: "forced-error",
    },
  );
});
