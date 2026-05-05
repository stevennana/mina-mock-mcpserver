import { expect, test } from "@playwright/test";

function basic(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

test("REST tools call executes exact matches, Basic auth, errors, and console evidence @rest-tools-call", async ({
  page,
  request,
}) => {
  const suffix = Date.now();
  const endpointName = `rest_call_${suffix}`;
  const username = `rest_call_basic_${suffix}`;
  const password = "created-secret";

  const endpointCreate = await request.post("/api/endpoints", {
    data: {
      name: endpointName,
      title: "REST call endpoint",
      description: "Callable through REST tool calls.",
      enabled: true,
      deleteCode: "87654321",
      defaultResponseJson: "{}",
      failureMode: "none",
      failureDelayMs: 0,
      parameters: [
        {
          name: "city",
          label: "City",
          description: "City exact-match key.",
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
          responseJson: JSON.stringify({ ok: true, source: "default-case" }),
          statusCode: 200,
          delayMs: 0,
          errorMode: "none",
          isDefault: true,
        },
        {
          name: "seoul",
          priority: 10,
          matchArgsJson: JSON.stringify({ city: "Seoul" }),
          responseJson: JSON.stringify({ ok: true, city: "Seoul", temperature: 22 }),
          statusCode: 201,
          delayMs: 0,
          errorMode: "none",
          isDefault: false,
        },
        {
          name: "forced-error",
          priority: 20,
          matchArgsJson: JSON.stringify({ city: "Error" }),
          responseJson: JSON.stringify({ unused: true }),
          statusCode: 200,
          delayMs: 0,
          errorMode: "error",
          errorStatusCode: 503,
          errorMessage: "Forced upstream outage.",
          errorBodyJson: JSON.stringify({ error: "upstream_unavailable", message: "Forced upstream outage." }),
          isDefault: false,
        },
      ],
    },
  });
  expect(endpointCreate.status()).toBe(201);

  const userCreate = await request.post("/api/basic-users", {
    data: { username, password, enabled: true },
  });
  expect(userCreate.status()).toBe(201);

  const success = await request.post(`/rest/tools/${endpointName}/call`, {
    data: { arguments: { city: "Seoul" } },
  });
  expect(success.status()).toBe(201);
  expect(success.headers()["x-mcp-mock-matched-case"]).toBe("seoul");
  expect(success.headers()["x-mcp-mock-principal"]).toBe("anonymous");
  expect(await success.json()).toEqual({ ok: true, city: "Seoul", temperature: 22 });

  const basicSuccess = await request.post(`/rest/tools/${endpointName}/call`, {
    headers: { Authorization: basic(username, password) },
    data: { arguments: { city: "Seoul" } },
  });
  expect(basicSuccess.status()).toBe(201);
  expect(basicSuccess.headers()["x-mcp-mock-principal"]).toBe(`basic:${username}`);

  const defaultCase = await request.post(`/rest/tools/${endpointName}/call`, {
    data: { arguments: { city: "Busan" } },
  });
  expect(defaultCase.status()).toBe(200);
  expect(defaultCase.headers()["x-mcp-mock-matched-case"]).toBe("default");
  expect(await defaultCase.json()).toEqual({ ok: true, source: "default-case" });

  const invalidArguments = await request.post(`/rest/tools/${endpointName}/call`, {
    data: { arguments: { city: 123 } },
  });
  expect(invalidArguments.status()).toBe(422);
  await expect(invalidArguments.json()).resolves.toEqual({
    error: "invalid_arguments",
    message: 'Argument "city" must be string.',
  });

  const forcedError = await request.post(`/rest/tools/${endpointName}/call`, {
    data: { arguments: { city: "Error" } },
  });
  expect(forcedError.status()).toBe(503);
  expect(forcedError.headers()["x-mcp-mock-matched-case"]).toBe("forced-error");
  await expect(forcedError.json()).resolves.toEqual({
    error: "upstream_unavailable",
    message: "Forced upstream outage.",
  });

  const unknownTool = await request.post(`/rest/tools/missing_${suffix}/call`, {
    data: { arguments: {} },
  });
  expect(unknownTool.status()).toBe(404);
  await expect(unknownTool.json()).resolves.toEqual({
    error: "tool_not_found",
    message: "Tool was not found or is disabled.",
  });

  const invalidAuth = await request.post(`/rest/tools/${endpointName}/call`, {
    headers: { Authorization: basic(username, "wrong-password") },
    data: { arguments: { city: "Seoul" } },
  });
  expect(invalidAuth.status()).toBe(401);
  expect(invalidAuth.headers()["www-authenticate"]).toContain("Basic");
  await expect(invalidAuth.json()).resolves.toEqual({
    error: "unauthorized",
    message: "Authorization header was invalid.",
  });

  await page.goto("/endpoints");
  await page.getByLabel("Search").fill(endpointName);
  await page.getByRole("button", { name: endpointName }).click();
  await expect(page.getByRole("textbox", { name: /^Name/ })).toHaveValue(endpointName);

  const consoleRegion = page.getByRole("region", { name: "Endpoint test console" });
  await consoleRegion.getByLabel("Arguments JSON").fill('{"city":"Seoul"}');
  await consoleRegion.getByRole("button", { name: "Run REST call" }).click();
  await expect(consoleRegion.getByText("REST call completed.")).toBeVisible();
  await expect(consoleRegion.getByRole("region", { name: "Raw request" })).toContainText(`/rest/tools/${endpointName}/call`);
  await expect(consoleRegion.getByRole("region", { name: "Raw response" })).toContainText('"city": "Seoul"');
  await expect(consoleRegion.getByRole("region", { name: "Matched case" })).toContainText("seoul");
  await expect(consoleRegion.getByRole("region", { name: "Principal" })).toContainText("anonymous");
  await expect(consoleRegion.getByRole("region", { name: "Elapsed time" })).toContainText("ms");

  await consoleRegion.getByLabel("Auth mode").selectOption("basic");
  await consoleRegion.getByLabel("Basic username").fill(username);
  await consoleRegion.getByLabel("Basic password").fill(password);
  await consoleRegion.getByRole("button", { name: "Run REST call" }).click();
  await expect(consoleRegion.getByRole("region", { name: "Principal" })).toContainText(`basic:${username}`);
});
