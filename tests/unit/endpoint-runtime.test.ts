import assert from "node:assert/strict";
import test from "node:test";
import { applyEndpointCallDelay, executeEndpointDetail, selectEndpointResponseCase } from "@/lib/endpoints/runtime";
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

test("endpoint runtime resolves endpoint and case delay predictably", async () => {
  const endpointDelayResult = executeEndpointDetail(
    endpointFixture({ failureMode: "delay", failureDelayMs: 125 }),
    { city: "Busan", units: false },
  );
  assert.equal(endpointDelayResult.kind, "matched");
  if (endpointDelayResult.kind !== "matched") return;
  assert.equal(endpointDelayResult.delayMs, 125);

  const caseDelayResult = executeEndpointDetail(
    endpointFixture({
      failureMode: "delay",
      failureDelayMs: 125,
      responseCases: endpointFixture().responseCases.map((responseCase) =>
        responseCase.name === "seoul" ? { ...responseCase, delayMs: 40 } : responseCase,
      ),
    }),
    { city: "Seoul" },
  );
  assert.equal(caseDelayResult.kind, "matched");
  if (caseDelayResult.kind !== "matched") return;
  assert.equal(caseDelayResult.delayMs, 40);

  const slept: number[] = [];
  await applyEndpointCallDelay(caseDelayResult, async (delayMs) => {
    slept.push(delayMs);
  });
  assert.deepEqual(slept, [40]);
});

test("endpoint runtime maps forced endpoint and case protocol errors", () => {
  const endpointError = executeEndpointDetail(
    endpointFixture({
      failureMode: "error",
      failureStatusCode: 502,
      failureDelayMs: 30_000,
      failureMessage: "Endpoint is forcing a gateway error.",
    }),
    { city: "Seoul" },
  );
  assert.equal(endpointError.kind, "protocol_error");
  if (endpointError.kind !== "protocol_error") return;
  assert.equal(endpointError.statusCode, 502);
  assert.equal(endpointError.message, "Endpoint is forcing a gateway error.");
  assert.equal(endpointError.delayMs, 30_000);
  assert.equal(endpointError.matchedCase.name, "seoul");

  const caseProtocolError = executeEndpointDetail(
    endpointFixture({
      responseCases: endpointFixture().responseCases.map((responseCase) =>
        responseCase.name === "seoul"
          ? {
              ...responseCase,
              errorMode: "protocol_error",
              errorStatusCode: 529,
              errorMessage: "Case forced protocol break.",
            }
          : responseCase,
      ),
    }),
    { city: "Seoul" },
  );
  assert.equal(caseProtocolError.kind, "protocol_error");
  if (caseProtocolError.kind !== "protocol_error") return;
  assert.equal(caseProtocolError.statusCode, 529);
  assert.equal(caseProtocolError.message, "Case forced protocol break.");
});
