import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { recordAuditEvent } from "@/lib/audit/service";
import { hashBasicPassword, verifyBasicPassword } from "@/lib/basic-auth/passwords";
import { createPrismaClient } from "@/lib/db/client";
import {
  DEFAULT_OAUTH_ACCESS_TOKEN_TTL_SECONDS,
  DEFAULT_OAUTH_PASSWORD,
  DEFAULT_OAUTH_USER_ID,
  DEFAULT_OAUTH_USERNAME,
  OAuthUserBuiltInError,
  OAuthUserNotFoundError,
  OAUTH_ACCESS_TOKEN_TTL_PRESETS,
} from "@/lib/oauth/types";
import { validateOAuthUserCreateInput, validateOAuthUserUpdateInput } from "@/lib/oauth/validation";
import type { OAuthUserCreateInput, OAuthUserListResult, OAuthUserSummary, OAuthUserUpdateInput } from "@/lib/oauth/types";

type OAuthUserRecord = Prisma.OAuthUserGetPayload<object>;
type OAuthUserSeedClient = Pick<PrismaClient, "oAuthUser">;

function toSummary(user: OAuthUserRecord): OAuthUserSummary {
  return {
    id: user.id,
    username: user.username,
    enabled: user.enabled,
    builtIn: user.builtIn,
    accessTokenTtlSeconds: user.accessTokenTtlSeconds,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function seedOAuthUserDefaults(client: OAuthUserSeedClient = createPrismaClient()) {
  const passwordHash = await hashBasicPassword(DEFAULT_OAUTH_PASSWORD);
  await client.oAuthUser.upsert({
    where: { id: DEFAULT_OAUTH_USER_ID },
    update: {
      username: DEFAULT_OAUTH_USERNAME,
      passwordHash,
      enabled: true,
      builtIn: true,
      accessTokenTtlSeconds: DEFAULT_OAUTH_ACCESS_TOKEN_TTL_SECONDS,
    },
    create: {
      id: DEFAULT_OAUTH_USER_ID,
      username: DEFAULT_OAUTH_USERNAME,
      passwordHash,
      enabled: true,
      builtIn: true,
      accessTokenTtlSeconds: DEFAULT_OAUTH_ACCESS_TOKEN_TTL_SECONDS,
    },
  });
}

export async function listOAuthUsers(client: PrismaClient = createPrismaClient()): Promise<OAuthUserListResult> {
  const users = await client.oAuthUser.findMany({
    orderBy: [{ builtIn: "desc" }, { username: "asc" }],
  });
  const summaries = users.map(toSummary);

  return {
    total: summaries.length,
    enabled: summaries.filter((user) => user.enabled).length,
    disabled: summaries.filter((user) => !user.enabled).length,
    users: summaries,
    ttlPresets: OAUTH_ACCESS_TOKEN_TTL_PRESETS,
  };
}

export async function createOAuthUser(input: OAuthUserCreateInput, client: PrismaClient = createPrismaClient()) {
  const validInput = validateOAuthUserCreateInput(input);
  const user = await client.oAuthUser.create({
    data: {
      id: `oauth_user_${randomUUID()}`,
      username: validInput.username,
      passwordHash: await hashBasicPassword(validInput.password),
      enabled: validInput.enabled,
      builtIn: false,
      accessTokenTtlSeconds: validInput.accessTokenTtlSeconds,
    },
  });

  await recordAuditEvent(
    {
      eventType: "oauth_user.create",
      subjectType: "oauth_user",
      subjectId: user.id,
      subjectName: user.username,
      outcome: "success",
      metadata: { enabled: user.enabled, accessTokenTtlSeconds: user.accessTokenTtlSeconds },
    },
    client,
  );

  return toSummary(user);
}

export async function updateOAuthUser(
  id: string,
  input: OAuthUserUpdateInput,
  client: PrismaClient = createPrismaClient(),
) {
  const existing = await client.oAuthUser.findUnique({ where: { id } });
  if (!existing) {
    throw new OAuthUserNotFoundError();
  }
  if (existing.builtIn) {
    throw new OAuthUserBuiltInError("update");
  }

  const validInput = validateOAuthUserUpdateInput(input);
  const data: Prisma.OAuthUserUpdateInput = {};
  if (typeof validInput.enabled === "boolean") {
    data.enabled = validInput.enabled;
  }
  if (validInput.password) {
    data.passwordHash = await hashBasicPassword(validInput.password);
  }
  if (typeof validInput.accessTokenTtlSeconds === "number") {
    data.accessTokenTtlSeconds = validInput.accessTokenTtlSeconds;
  }

  const user = await client.oAuthUser.update({
    where: { id },
    data,
  });

  await recordAuditEvent(
    {
      eventType: "oauth_user.update",
      subjectType: "oauth_user",
      subjectId: user.id,
      subjectName: user.username,
      outcome: "success",
      metadata: {
        enabled: user.enabled,
        accessTokenTtlSeconds: user.accessTokenTtlSeconds,
        passwordChanged: Boolean(validInput.password),
      },
    },
    client,
  );

  return toSummary(user);
}

export async function deleteOAuthUser(id: string, client: PrismaClient = createPrismaClient()) {
  const existing = await client.oAuthUser.findUnique({ where: { id } });
  if (!existing) {
    throw new OAuthUserNotFoundError();
  }
  if (existing.builtIn) {
    throw new OAuthUserBuiltInError("delete");
  }

  await client.$transaction(async (tx) => {
    await tx.oAuthUser.delete({ where: { id } });
    await recordAuditEvent(
      {
        eventType: "oauth_user.delete",
        subjectType: "oauth_user",
        subjectId: existing.id,
        subjectName: existing.username,
        outcome: "success",
      },
      tx,
    );
  });

  return toSummary(existing);
}

export async function verifyOAuthUserCredentials(
  username: string,
  password: string,
  client: PrismaClient = createPrismaClient(),
) {
  const user = await client.oAuthUser.findUnique({ where: { username } });
  if (!user || !user.enabled) {
    return null;
  }
  const verified = await verifyBasicPassword(password, user.passwordHash);
  return verified ? toSummary(user) : null;
}
