import { BasicUserValidationError } from "@/lib/basic-auth/types";
import type { BasicUserCreateInput, BasicUserUpdateInput } from "@/lib/basic-auth/types";

const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{1,64}$/;

export function validateBasicUserCreateInput(input: BasicUserCreateInput): BasicUserCreateInput {
  const fieldErrors: Record<string, string> = {};
  const username = input.username.trim();
  const password = input.password;

  if (!USERNAME_PATTERN.test(username)) {
    fieldErrors.username = "Use 1-64 letters, numbers, dots, underscores, or hyphens.";
  }
  if (password.length < 1 || password.length > 256) {
    fieldErrors.password = "Enter a password between 1 and 256 characters.";
  }

  if (Object.keys(fieldErrors).length) {
    throw new BasicUserValidationError(fieldErrors);
  }

  return {
    username,
    password,
    enabled: input.enabled,
  };
}

export function validateBasicUserUpdateInput(input: BasicUserUpdateInput): BasicUserUpdateInput {
  const fieldErrors: Record<string, string> = {};
  const password = input.password ?? null;

  if (password !== null && (password.length < 1 || password.length > 256)) {
    fieldErrors.password = "Enter a password between 1 and 256 characters.";
  }

  if (Object.keys(fieldErrors).length) {
    throw new BasicUserValidationError(fieldErrors);
  }

  return {
    password,
    enabled: input.enabled,
  };
}
