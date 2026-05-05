import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { recordAuditEvent } from "@/lib/audit/service";
import { createPrismaClient } from "@/lib/db/client";
import { hashBasicPassword, verifyBasicPassword } from "@/lib/basic-auth/passwords";
import {
  BasicUserBuiltInError,
  BasicUserNotFoundError,
  DEFAULT_BASIC_PASSWORD,
  DEFAULT_BASIC_USER_ID,
  DEFAULT_BASIC_USERNAME,
} from "@/lib/basic-auth/types";
import { validateBasicUserCreateInput, validateBasicUserUpdateInput } from "@/lib/basic-auth/validation";
import type { BasicUserCreateInput, BasicUserListResult, BasicUserSummary, BasicUserUpdateInput } from "@/lib/basic-auth/types";

type BasicUserRecord = Prisma.BasicUserGetPayload<object>;
type BasicUserSeedClient = Pick<PrismaClient, "basicUser">;

function toSummary(user: BasicUserRecord): BasicUserSummary {
  return {
    id: user.id,
    username: user.username,
    enabled: user.enabled,
    builtIn: user.builtIn,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function seedBasicUserDefaults(client: BasicUserSeedClient = createPrismaClient()) {
  const passwordHash = await hashBasicPassword(DEFAULT_BASIC_PASSWORD);
  await client.basicUser.upsert({
    where: { id: DEFAULT_BASIC_USER_ID },
    update: {
      username: DEFAULT_BASIC_USERNAME,
      passwordHash,
      enabled: true,
      builtIn: true,
    },
    create: {
      id: DEFAULT_BASIC_USER_ID,
      username: DEFAULT_BASIC_USERNAME,
      passwordHash,
      enabled: true,
      builtIn: true,
    },
  });
}

export async function listBasicUsers(client: PrismaClient = createPrismaClient()): Promise<BasicUserListResult> {
  const users = await client.basicUser.findMany({
    orderBy: [{ builtIn: "desc" }, { username: "asc" }],
  });
  const summaries = users.map(toSummary);

  return {
    total: summaries.length,
    enabled: summaries.filter((user) => user.enabled).length,
    disabled: summaries.filter((user) => !user.enabled).length,
    users: summaries,
  };
}

export async function createBasicUser(input: BasicUserCreateInput, client: PrismaClient = createPrismaClient()) {
  const validInput = validateBasicUserCreateInput(input);
  const user = await client.basicUser.create({
    data: {
      id: `basic_user_${randomUUID()}`,
      username: validInput.username,
      passwordHash: await hashBasicPassword(validInput.password),
      enabled: validInput.enabled,
      builtIn: false,
    },
  });

  await recordAuditEvent(
    {
      eventType: "basic_user.create",
      subjectType: "basic_user",
      subjectId: user.id,
      subjectName: user.username,
      outcome: "success",
      metadata: { enabled: user.enabled },
    },
    client,
  );

  return toSummary(user);
}

export async function updateBasicUser(
  id: string,
  input: BasicUserUpdateInput,
  client: PrismaClient = createPrismaClient(),
) {
  const existing = await client.basicUser.findUnique({ where: { id } });
  if (!existing) {
    throw new BasicUserNotFoundError();
  }
  if (existing.builtIn) {
    throw new BasicUserBuiltInError("update");
  }

  const validInput = validateBasicUserUpdateInput(input);
  const data: Prisma.BasicUserUpdateInput = {};
  if (typeof validInput.enabled === "boolean") {
    data.enabled = validInput.enabled;
  }
  if (validInput.password) {
    data.passwordHash = await hashBasicPassword(validInput.password);
  }

  const user = await client.basicUser.update({
    where: { id },
    data,
  });

  await recordAuditEvent(
    {
      eventType: "basic_user.update",
      subjectType: "basic_user",
      subjectId: user.id,
      subjectName: user.username,
      outcome: "success",
      metadata: { enabled: user.enabled, passwordChanged: Boolean(validInput.password) },
    },
    client,
  );

  return toSummary(user);
}

export async function deleteBasicUser(id: string, client: PrismaClient = createPrismaClient()) {
  const existing = await client.basicUser.findUnique({ where: { id } });
  if (!existing) {
    throw new BasicUserNotFoundError();
  }
  if (existing.builtIn) {
    throw new BasicUserBuiltInError("delete");
  }

  await client.$transaction(async (tx) => {
    await tx.basicUser.delete({ where: { id } });
    await recordAuditEvent(
      {
        eventType: "basic_user.delete",
        subjectType: "basic_user",
        subjectId: existing.id,
        subjectName: existing.username,
        outcome: "success",
      },
      tx,
    );
  });

  return toSummary(existing);
}

export async function verifyBasicCredentials(
  username: string,
  password: string,
  client: PrismaClient = createPrismaClient(),
) {
  const user = await client.basicUser.findUnique({ where: { username } });
  if (!user || !user.enabled) {
    return null;
  }
  const verified = await verifyBasicPassword(password, user.passwordHash);
  return verified ? toSummary(user) : null;
}
