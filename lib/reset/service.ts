import type { PrismaClient } from "@prisma/client";
import { recordAuditEvent } from "@/lib/audit/service";
import { createPrismaClient } from "@/lib/db/client";
import { seedAllDefaults } from "@/lib/db/seed";
import { verifyRootPassword } from "@/lib/security/root-password";
import { RESET_CONFIRMATION_TEXT, ResetAuthorizationError } from "@/lib/reset/types";
import type { ResetInput, ResetResult } from "@/lib/reset/types";

function resetReasonFor(input: ResetInput) {
  const confirmation = input.confirmation?.trim() ?? "";
  if (!confirmation) {
    return "missing_confirmation";
  }
  if (confirmation !== RESET_CONFIRMATION_TEXT) {
    return "invalid_confirmation";
  }
  if (!verifyRootPassword(input.rootPassword)) {
    return "invalid_root_password";
  }
  return null;
}

async function recordResetFailure(reason: ResetAuthorizationError["reason"], client: PrismaClient) {
  await recordAuditEvent(
    {
      eventType: "system.reset",
      subjectType: "system",
      subjectId: "default-state",
      subjectName: "reset",
      outcome: "failure",
      metadata: { reason },
    },
    client,
  );
}

export async function resetToDefaults(input: ResetInput, client: PrismaClient = createPrismaClient()): Promise<ResetResult> {
  const failureReason = resetReasonFor(input);
  if (failureReason) {
    await recordResetFailure(failureReason, client);
    throw new ResetAuthorizationError(failureReason);
  }

  return client.$transaction(async (tx) => {
    const deletedOAuthUsers = await tx.oAuthUser.deleteMany({});
    const deletedBasicUsers = await tx.basicUser.deleteMany({});
    await tx.responseCase.deleteMany({});
    await tx.endpointParam.deleteMany({});
    const deletedEndpoints = await tx.endpoint.deleteMany({});

    await seedAllDefaults(tx);
    const seededEndpoints = await tx.endpoint.count();
    const seededBasicUsers = await tx.basicUser.count();
    const seededOAuthUsers = await tx.oAuthUser.count();

    await recordAuditEvent(
      {
        eventType: "system.reset",
        subjectType: "system",
        subjectId: "default-state",
        subjectName: "reset",
        outcome: "success",
        metadata: {
          method: "root_password",
          deletedEndpoints: deletedEndpoints.count,
          deletedBasicUsers: deletedBasicUsers.count,
          deletedOAuthUsers: deletedOAuthUsers.count,
          seededEndpoints,
          seededBasicUsers,
          seededOAuthUsers,
        },
      },
      tx,
    );

    return {
      deletedEndpoints: deletedEndpoints.count,
      seededEndpoints,
      deletedBasicUsers: deletedBasicUsers.count,
      seededBasicUsers,
      deletedOAuthUsers: deletedOAuthUsers.count,
      seededOAuthUsers,
    };
  });
}
