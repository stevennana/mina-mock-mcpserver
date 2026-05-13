export type LegacySseMode = "none" | "basic" | "oauth" | "unified";

export type LegacySseRuntime = {
  endpointIds?: string[];
  resourceIds?: string[];
  promptIds?: string[];
};

export type LegacySseSession = {
  mode: LegacySseMode;
  controller: ReadableStreamDefaultController<Uint8Array>;
  encoder: TextEncoder;
  runtime: LegacySseRuntime;
  heartbeat: ReturnType<typeof setInterval>;
  subscribedResourceUris: Set<string>;
};

const legacySseGlobal = globalThis as typeof globalThis & {
  __mcpMockLegacySseSessions?: Map<string, LegacySseSession>;
};

export const legacySseSessions = legacySseGlobal.__mcpMockLegacySseSessions ?? new Map<string, LegacySseSession>();
legacySseGlobal.__mcpMockLegacySseSessions = legacySseSessions;

export function sseEvent(event: string, data: unknown, id?: string) {
  const serialized = typeof data === "string" ? data : JSON.stringify(data);
  const dataLines = serialized.split(/\r?\n/).map((line) => `data: ${line}`);
  const lines = [...(id ? [`id: ${id}`] : []), `event: ${event}`, ...dataLines, "", ""];
  return lines.join("\n");
}

export function sseComment(message: string) {
  return `: ${message}\n\n`;
}

export function enqueueSse(session: LegacySseSession, payload: string) {
  try {
    session.controller.enqueue(session.encoder.encode(payload));
    return true;
  } catch {
    clearInterval(session.heartbeat);
    return false;
  }
}

export function cleanupLegacySseSession(sessionId: string) {
  const session = legacySseSessions.get(sessionId);
  if (!session) return;
  clearInterval(session.heartbeat);
  legacySseSessions.delete(sessionId);
}

export function subscribeLegacySseResource(sessionId: string, uri: string) {
  const session = legacySseSessions.get(sessionId);
  if (!session) return false;
  session.subscribedResourceUris.add(uri);
  return true;
}

export function unsubscribeLegacySseResource(sessionId: string, uri: string) {
  const session = legacySseSessions.get(sessionId);
  if (!session) return false;
  session.subscribedResourceUris.delete(uri);
  return true;
}

function notification(method: string, params?: Record<string, string>) {
  return {
    jsonrpc: "2.0",
    method,
    ...(params ? { params } : {}),
  };
}

function sessionCanSeeResource(session: LegacySseSession, resourceId?: string) {
  return !resourceId || !session.runtime.resourceIds || session.runtime.resourceIds.includes(resourceId);
}

function sessionCanSeePrompt(session: LegacySseSession, promptId?: string) {
  return !promptId || !session.runtime.promptIds || session.runtime.promptIds.includes(promptId);
}

function notifyMatchingSessions(
  matches: (session: LegacySseSession) => boolean,
  payload: ReturnType<typeof notification>,
) {
  try {
    for (const [sessionId, session] of legacySseSessions) {
      if (!matches(session)) continue;
      if (!enqueueSse(session, sseEvent("message", payload, `${Date.now()}-${sessionId}`))) {
        cleanupLegacySseSession(sessionId);
      }
    }
  } catch {
    // Notifications are best-effort local test behavior and must not break admin mutations.
  }
}

export function notifyLegacySseResourceUpdated(uri: string, resourceId?: string) {
  notifyMatchingSessions(
    (session) => session.subscribedResourceUris.has(uri) && sessionCanSeeResource(session, resourceId),
    notification("notifications/resources/updated", { uri }),
  );
}

export function notifyLegacySseResourceListChanged(resourceId?: string) {
  notifyMatchingSessions(
    (session) => sessionCanSeeResource(session, resourceId),
    notification("notifications/resources/list_changed"),
  );
}

export function notifyLegacySsePromptListChanged(promptId?: string) {
  notifyMatchingSessions(
    (session) => sessionCanSeePrompt(session, promptId),
    notification("notifications/prompts/list_changed"),
  );
}
