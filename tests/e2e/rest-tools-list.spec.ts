import { expect, test } from "@playwright/test";

function basic(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

test("REST tools list exposes enabled metadata for no-auth and Basic callers @rest-tools-list", async ({ request }) => {
  const suffix = Date.now();
  const enabledName = `rest_list_enabled_${suffix}`;
  const disabledName = `rest_list_disabled_${suffix}`;
  const username = `rest_basic_${suffix}`;
  const password = "created-secret";

  const enabledCreate = await request.post("/api/endpoints", {
    data: {
      name: enabledName,
      title: "REST list enabled",
      description: "Visible through REST tools list.",
      enabled: true,
      deleteCode: "87654321",
      defaultResponseJson: "{}",
      failureMode: "none",
      failureDelayMs: 0,
      parameters: [
        {
          name: "city",
          label: "City",
          description: "City name for REST metadata.",
          type: "string",
          required: true,
          defaultValueJson: '"Seoul"',
        },
      ],
      responseCases: [
        {
          name: "default",
          priority: 0,
          matchArgsJson: "{}",
          responseJson: "{}",
          statusCode: 200,
          delayMs: 0,
          errorMode: "none",
          isDefault: true,
        },
      ],
    },
  });
  expect(enabledCreate.status()).toBe(201);

  const disabledCreate = await request.post("/api/endpoints", {
    data: {
      name: disabledName,
      title: "REST list disabled",
      description: "Hidden from REST tools list.",
      enabled: false,
      deleteCode: "87654321",
      defaultResponseJson: "{}",
      failureMode: "none",
      failureDelayMs: 0,
      parameters: [],
      responseCases: [
        {
          name: "default",
          priority: 0,
          matchArgsJson: "{}",
          responseJson: "{}",
          statusCode: 200,
          delayMs: 0,
          errorMode: "none",
          isDefault: true,
        },
      ],
    },
  });
  expect(disabledCreate.status()).toBe(201);

  const userCreate = await request.post("/api/basic-users", {
    data: { username, password, enabled: true },
  });
  expect(userCreate.status()).toBe(201);

  const noAuthList = await request.get("/rest/tools");
  expect(noAuthList.status()).toBe(200);
  expect(noAuthList.headers()["content-type"]).toMatch(/application\/json/);
  const noAuthBody = (await noAuthList.json()) as {
    tools: Array<{ name: string; title: string; description: string; parameters: unknown[] }>;
  };
  expect(noAuthBody).not.toHaveProperty("jsonrpc");
  const toolNames = noAuthBody.tools.map((tool) => tool.name);
  expect(toolNames).toContain(enabledName);
  expect(toolNames).not.toContain(disabledName);
  expect(noAuthBody.tools.find((tool) => tool.name === enabledName)).toEqual({
    name: enabledName,
    title: "REST list enabled",
    description: "Visible through REST tools list.",
    parameters: [
      {
        name: "city",
        label: "City",
        description: "City name for REST metadata.",
        type: "string",
        required: true,
        defaultValue: "Seoul",
      },
    ],
  });

  const basicList = await request.get("/rest/tools", {
    headers: { Authorization: basic(username, password) },
  });
  expect(basicList.status()).toBe(200);
  const basicBody = (await basicList.json()) as typeof noAuthBody;
  expect(basicBody.tools.map((tool) => tool.name)).toContain(enabledName);
  expect(basicBody.tools.map((tool) => tool.name)).not.toContain(disabledName);

  const invalidBasic = await request.get("/rest/tools", {
    headers: { Authorization: basic(username, "wrong-password") },
  });
  expect(invalidBasic.status()).toBe(401);
  expect(invalidBasic.headers()["www-authenticate"]).toContain("Basic");
  await expect(invalidBasic.json()).resolves.toEqual({
    error: "unauthorized",
    message: "Authorization header was invalid.",
  });

  const unsupportedAuthorization = await request.get("/rest/tools", {
    headers: { Authorization: "Bearer deferred" },
  });
  expect(unsupportedAuthorization.status()).toBe(401);
});
