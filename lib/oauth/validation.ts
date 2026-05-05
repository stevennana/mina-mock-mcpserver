import { OAuthUserValidationError, OAUTH_ACCESS_TOKEN_TTL_PRESETS } from "@/lib/oauth/types";
import type { OAuthUserCreateInput, OAuthUserUpdateInput } from "@/lib/oauth/types";

const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{1,64}$/;
const ALLOWED_TTL_SECONDS = new Set<number>(OAUTH_ACCESS_TOKEN_TTL_PRESETS.map((preset) => preset.seconds));

function validateTtl(value: number | undefined, fieldErrors: Record<string, string>) {
  if (typeof value !== "number" || !Number.isInteger(value) || !ALLOWED_TTL_SECONDS.has(value)) {
    fieldErrors.accessTokenTtlSeconds = "Choose one of the MVP token TTL presets.";
  }
}

export function validateOAuthUserCreateInput(input: OAuthUserCreateInput): OAuthUserCreateInput {
  const fieldErrors: Record<string, string> = {};
  const username = input.username.trim();
  const password = input.password;

  if (!USERNAME_PATTERN.test(username)) {
    fieldErrors.username = "Use 1-64 letters, numbers, dots, underscores, or hyphens.";
  }
  if (password.length < 1 || password.length > 256) {
    fieldErrors.password = "Enter a password between 1 and 256 characters.";
  }
  validateTtl(input.accessTokenTtlSeconds, fieldErrors);

  if (Object.keys(fieldErrors).length) {
    throw new OAuthUserValidationError(fieldErrors);
  }

  return {
    username,
    password,
    enabled: input.enabled,
    accessTokenTtlSeconds: input.accessTokenTtlSeconds,
  };
}

export function validateOAuthUserUpdateInput(input: OAuthUserUpdateInput): OAuthUserUpdateInput {
  const fieldErrors: Record<string, string> = {};
  const password = input.password ?? null;

  if (password !== null && (password.length < 1 || password.length > 256)) {
    fieldErrors.password = "Enter a password between 1 and 256 characters.";
  }
  if (input.accessTokenTtlSeconds !== undefined) {
    validateTtl(input.accessTokenTtlSeconds, fieldErrors);
  }

  if (Object.keys(fieldErrors).length) {
    throw new OAuthUserValidationError(fieldErrors);
  }

  return {
    password,
    enabled: input.enabled,
    accessTokenTtlSeconds: input.accessTokenTtlSeconds,
  };
}
