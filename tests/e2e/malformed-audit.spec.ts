import { expect, test } from "@playwright/test";

function endpointInput(name: string, failureMode: string, overrides: Record<string, unknown> = {}) {
  return {
    name,
    title: name,
    description: "Malformed response audit E2E fixture.",
    enabled: true,
    deleteCode: "87654321",
    defaultResponseJson: "{}",
    failureMode,
    failureDelayMs: 0,
    failureStatusCode: null,
    failureMessage: "",
    malformedResponseJson: "",
    parameters: [],
    responseCases: [
      {
        name: "default",
        priority: 0,
        matchArgsJson: "{}",
        responseJson: JSON.stringify({ ok: true, name }),
        statusCode: 200,
        delayMs: 0,
        errorMode: "none",
        isDefault: true,
      },
    ],
    ...overrides,
  };
}

test("malformed response modes show console evidence and audit records @malformed-audit", async ({
  page,
  request,
}) => {
  const suffix = Date.now() % 1_000_000;
  const invalidName = `malformed_invalid_${suffix}`;
  const contentTypeName = `malformed_content_${suffix}`;
  const emptyBodyName = `malformed_empty_${suffix}`;
  const normalName = `malformed_normal_${suffix}`;

  const invalidCreate = await request.post("/api/endpoints", {
    data: endpointInput(invalidName, "invalid_json", { failureStatusCode: 209 }),
  });
  expect(invalidCreate.status()).toBe(201);
  const invalidEndpoint = (await invalidCreate.json()).endpoint as { id: string };

  const contentTypeCreate = await request.post("/api/endpoints", {
    data: endpointInput(contentTypeName, "wrong_content_type", {
      malformedResponseJson: JSON.stringify({ ok: true, wrongContentType: true }),
    }),
  });
  expect(contentTypeCreate.status()).toBe(201);

  const emptyBodyCreate = await request.post("/api/endpoints", {
    data: endpointInput(emptyBodyName, "empty_body"),
  });
  expect(emptyBodyCreate.status()).toBe(201);

  const normalCreate = await request.post("/api/endpoints", {
    data: endpointInput(normalName, "none"),
  });
  expect(normalCreate.status()).toBe(201);

  const invalidRest = await request.post(`/rest/tools/${invalidName}/call`, { data: { arguments: {} } });
  expect(invalidRest.status()).toBe(209);
  expect(invalidRest.headers()["content-type"]).toContain("application/json");
  expect(invalidRest.headers()["x-mcp-mock-malformed-mode"]).toBe("invalid_json");
  expect(invalidRest.headers()["x-mcp-mock-matched-case"]).toBe("default");
  expect(invalidRest.headers()["x-mcp-mock-principal"]).toBe("anonymous");
  await expect(invalidRest.json()).rejects.toThrow();

  const contentTypeRest = await request.post(`/rest/tools/${contentTypeName}/call`, { data: { arguments: {} } });
  expect(contentTypeRest.status()).toBe(200);
  expect(contentTypeRest.headers()["content-type"]).toContain("text/plain");
  expect(contentTypeRest.headers()["x-mcp-mock-malformed-mode"]).toBe("wrong_content_type");
  expect(await contentTypeRest.text()).toBe('{"ok":true,"wrongContentType":true}');

  const emptyBodyMcp = await request.post("/mcp/none", {
    data: {
      jsonrpc: "2.0",
      id: "empty-body",
      method: "tools/call",
      params: { name: emptyBodyName, arguments: {} },
    },
  });
  expect(emptyBodyMcp.status()).toBe(200);
  expect(emptyBodyMcp.headers()["x-mcp-mock-matched-case"]).toBe("default");
  expect(await emptyBodyMcp.text()).toBe("");

  const normalRest = await request.post(`/rest/tools/${normalName}/call`, { data: { arguments: {} } });
  expect(normalRest.status()).toBe(200);
  expect(normalRest.headers()["x-mcp-mock-malformed-mode"]).toBeUndefined();
  await expect(normalRest.json()).resolves.toEqual({ ok: true, name: normalName });

  await page.goto("/endpoints");
  await page.getByLabel("Search").fill(invalidName);
  await page.getByRole("button", { name: invalidName }).click();
  await expect(page.getByText("Saving this endpoint will make only this endpoint return invalid JSON responses")).toBeVisible();
  const consoleRegion = page.getByRole("region", { name: "Endpoint test console" });
  await expect(consoleRegion.getByText("Running the console will show the raw invalid JSON HTTP response")).toBeVisible();
  await consoleRegion.getByRole("button", { name: "Run REST call" }).click();
  await expect(consoleRegion.getByRole("region", { name: "Raw response" })).toContainText("HTTP 209");
  await expect(consoleRegion.getByRole("region", { name: "Raw response" })).toContainText("x-mcp-mock-malformed-mode: invalid_json");
  await expect(consoleRegion.getByRole("region", { name: "Matched case" })).toContainText("default");
  await expect(consoleRegion.getByRole("region", { name: "Principal" })).toContainText("anonymous");
  await expect(consoleRegion.getByRole("region", { name: "Elapsed time" })).toContainText("ms");

  const endpointDetail = await request.get(`/api/endpoints/${invalidEndpoint.id}`);
  expect(endpointDetail.status()).toBe(200);
  const endpointPayload = await endpointDetail.json();
  const updateResponse = await request.patch(`/api/endpoints/${invalidEndpoint.id}`, {
    data: {
      ...endpointPayload.endpoint,
      failureMode: "empty_body",
      failureStatusCode: null,
    },
  });
  expect(updateResponse.status()).toBe(200);

  await page.goto("/audit");
  const auditRow = page.getByRole("row").filter({ hasText: invalidName }).filter({ hasText: "endpoint.failure_simulation.update" }).first();
  await expect(auditRow).toBeVisible();
  await expect(auditRow).toContainText('"mode":"empty_body"');
  await expect(auditRow).toContainText('"previousMode":"invalid_json"');
  await expect(auditRow).toContainText('"hasMalformedResponseBody":false');
  await expect(auditRow).not.toContainText("87654321");
});
