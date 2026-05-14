import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanupLegacySseSession,
  legacySseSessions,
  notifyLegacySsePromptListChanged,
  notifyLegacySseResourceListChanged,
  notifyLegacySseResourceUpdated,
  subscribeLegacySseResource,
  unsubscribeLegacySseResource,
} from "@/lib/mcp/sse-notifications";

function addTestSession(sessionId: string, runtime: { resourceIds?: string[]; promptIds?: string[] } = {}) {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  const controller = {
    enqueue(chunk: Uint8Array) {
      chunks.push(new TextDecoder().decode(chunk));
    },
  } as ReadableStreamDefaultController<Uint8Array>;
  const heartbeat = setInterval(() => undefined, 60_000);
  legacySseSessions.set(sessionId, {
    mode: "none",
    controller,
    encoder,
    runtime,
    heartbeat,
    subscribedResourceUris: new Set(),
  });
  return chunks;
}

test.afterEach(() => {
  for (const sessionId of legacySseSessions.keys()) {
    cleanupLegacySseSession(sessionId);
  }
});

test("legacy SSE resource subscriptions receive only matching resource update notifications", async () => {
  const subscribedChunks = addTestSession("subscribed");
  const unsubscribedChunks = addTestSession("unsubscribed");

  assert.equal(subscribeLegacySseResource("subscribed", "mock://resources/status"), true);
  notifyLegacySseResourceUpdated("mock://resources/status", "resource_status");
  await Promise.resolve();

  assert.match(subscribedChunks.join(""), /notifications\/resources\/updated/);
  assert.match(subscribedChunks.join(""), /mock:\/\/resources\/status/);
  assert.equal(unsubscribedChunks.join("").includes("notifications/resources/updated"), false);
});

test("legacy SSE unsubscribe removes the resource update subscription", async () => {
  const chunks = addTestSession("session");

  assert.equal(subscribeLegacySseResource("session", "mock://resources/status"), true);
  assert.equal(unsubscribeLegacySseResource("session", "mock://resources/status"), true);
  notifyLegacySseResourceUpdated("mock://resources/status", "resource_status");
  await Promise.resolve();

  assert.equal(chunks.join("").includes("notifications/resources/updated"), false);
});

test("legacy SSE list notifications respect OAuth resource and prompt permissions", async () => {
  const allowedChunks = addTestSession("allowed", { resourceIds: ["resource_allowed"], promptIds: ["prompt_allowed"] });
  const deniedChunks = addTestSession("denied", { resourceIds: ["resource_other"], promptIds: ["prompt_other"] });

  notifyLegacySseResourceListChanged("resource_allowed");
  notifyLegacySsePromptListChanged("prompt_allowed");
  await Promise.resolve();

  assert.match(allowedChunks.join(""), /notifications\/resources\/list_changed/);
  assert.match(allowedChunks.join(""), /notifications\/prompts\/list_changed/);
  assert.equal(deniedChunks.join("").includes("notifications/resources/list_changed"), false);
  assert.equal(deniedChunks.join("").includes("notifications/prompts/list_changed"), false);
});
