import assert from "node:assert/strict";
import test from "node:test";
import { executeEndpointDetail, selectEndpointResponseCase } from "@/lib/endpoints/runtime";
import type { EndpointDetail } from "@/lib/endpoints/types";

function endpointFixture(overrides: Partial<EndpointDetail> = {}): EndpointDetail {
  return {
    id: "endpoint_weather",
    name: "weather",
    title: "Weather",
    description: "Weather fixture.",
    enabled: true,
    protectedDefault: false,
    parameterCount: 2,
    responseCaseCount: 2,
    updatedAt: "2026-05-05T00:00:00.000Z",
    deleteCode: null,
    defaultResponseJson: "{}",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
    failureMode: "none",
    failureStatusCode: null,
    failureDelayMs: 0,
    failureMessage: null,
    malformedResponseJson: null,
    parameters: [
      {
        id: "param_city",
        position: 0,
        name: "city",
        label: "City",
        description: "City name.",
        type: "string",
        required: true,
        defaultValueJson: null,
      },
      {
        id: "param_units",
        position: 1,
        name: "units",
        label: "Units",
        description: "Units flag.",
        type: "boolean",
        required: false,
        defaultValueJson: "true",
      },
    ],
    responseCases: [
      {
        id: "case_default",
        name: "default",
        priority: 0,
        matchArgsJson: "{}",
        responseJson: JSON.stringify({ ok: true, source: "default" }),
        statusCode: 200,
        delayMs: 0,
        errorMode: "none",
        errorStatusCode: null,
        errorMessage: null,
        errorBodyJson: null,
        isDefault: true,
      },
      {
        id: "case_seoul",
        name: "seoul",
        priority: 10,
        matchArgsJson: JSON.stringify({ city: "Seoul", units: true }),
        responseJson: JSON.stringify({ ok: true, city: "Seoul" }),
        statusCode: 200,
        delayMs: 0,
        errorMode: "none",
        errorStatusCode: null,
        errorMessage: null,
        errorBodyJson: null,
        isDefault: false,
      },
    ],
    ...overrides,
  };
}

test("endpoint runtime selects exact response cases after applying defaults", () => {
  const selected = selectEndpointResponseCase(endpointFixture(), { city: "Seoul" });

  assert.equal(selected.ok, true);
  if (!selected.ok) return;
  assert.equal(selected.value.name, "seoul");
  assert.deepEqual(selected.arguments, { city: "Seoul", units: true });
});

test("endpoint runtime falls back to the configured default case on no exact match", () => {
  const result = executeEndpointDetail(endpointFixture(), { city: "Busan", units: false });

  assert.equal(result.kind, "matched");
  if (result.kind !== "matched") return;
  assert.deepEqual(result.body, { ok: true, source: "default" });
  assert.equal(result.matchedCase.name, "default");
});

test("endpoint runtime reports disabled endpoints and invalid arguments deterministically", () => {
  assert.deepEqual(executeEndpointDetail(endpointFixture({ enabled: false }), { city: "Seoul" }), {
    kind: "disabled",
  });

  assert.deepEqual(executeEndpointDetail(endpointFixture(), { city: 123 }), {
    kind: "invalid_arguments",
    message: 'Argument "city" must be string.',
  });
});
