import {
  OAuthClientValidationError,
  OAuthUserValidationError,
  OAUTH_ACCESS_TOKEN_TTL_PRESETS,
  OAUTH_CLIENT_CREDENTIALS_TTL_PRESETS,
} from "@/lib/oauth/types";
import type { OAuthClientCreateInput, OAuthClientUpdateInput, OAuthUserCreateInput, OAuthUserUpdateInput } from "@/lib/oauth/types";

const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{1,64}$/;
const CLIENT_ID_PATTERN = /^[a-zA-Z0-9_.:-]{1,96}$/;
const ALLOWED_TTL_SECONDS = new Set<number>(OAUTH_ACCESS_TOKEN_TTL_PRESETS.map((preset) => preset.seconds));
const ALLOWED_CLIENT_TTL_SECONDS = new Set<number>(OAUTH_CLIENT_CREDENTIALS_TTL_PRESETS.map((preset) => preset.seconds));

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

function validateClientTtl(value: number | undefined, fieldErrors: Record<string, string>) {
  if (typeof value !== "number" || !Number.isInteger(value) || !ALLOWED_CLIENT_TTL_SECONDS.has(value)) {
    fieldErrors.clientCredentialsTtlSeconds = "Choose one of the MVP client credentials TTL presets.";
  }
}

function normalizeRedirectUris(value: string[] | undefined, fieldErrors: Record<string, string>) {
  const redirectUris = Array.isArray(value) ? value.map((uri) => uri.trim()).filter(Boolean) : [];
  if (redirectUris.length > 10) {
    fieldErrors.redirectUris = "Use 10 redirect URIs or fewer.";
  }

  const uniqueRedirectUris = Array.from(new Set(redirectUris));
  for (const redirectUri of uniqueRedirectUris) {
    if (redirectUri.length > 500) {
      fieldErrors.redirectUris = "Each redirect URI must be 500 characters or fewer.";
      break;
    }
    try {
      const parsed = new URL(redirectUri);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        fieldErrors.redirectUris = "Redirect URIs must use http or https.";
        break;
      }
    } catch {
      fieldErrors.redirectUris = "Enter valid absolute redirect URIs.";
      break;
    }
  }

  return uniqueRedirectUris;
}

function normalizeAllowedEndpointIds(value: string[] | undefined, fieldErrors: Record<string, string>) {
  const endpointIds = Array.isArray(value) ? value.map((id) => id.trim()).filter(Boolean) : [];
  const uniqueEndpointIds = Array.from(new Set(endpointIds));
  if (uniqueEndpointIds.some((id) => id.length > 128)) {
    fieldErrors.allowedEndpointIds = "Allowed endpoint IDs are invalid.";
  }
  return uniqueEndpointIds;
}

function normalizeAllowedResourceIds(value: string[] | undefined, fieldErrors: Record<string, string>) {
  const resourceIds = Array.isArray(value) ? value.map((id) => id.trim()).filter(Boolean) : [];
  const uniqueResourceIds = Array.from(new Set(resourceIds));
  if (uniqueResourceIds.some((id) => id.length > 128)) {
    fieldErrors.allowedResourceIds = "Allowed resource IDs are invalid.";
  }
  return uniqueResourceIds;
}

function normalizeAllowedPromptIds(value: string[] | undefined, fieldErrors: Record<string, string>) {
  const promptIds = Array.isArray(value) ? value.map((id) => id.trim()).filter(Boolean) : [];
  const uniquePromptIds = Array.from(new Set(promptIds));
  if (uniquePromptIds.some((id) => id.length > 128)) {
    fieldErrors.allowedPromptIds = "Allowed prompt IDs are invalid.";
  }
  return uniquePromptIds;
}

export function validateOAuthClientCreateInput(input: OAuthClientCreateInput): OAuthClientCreateInput {
  const fieldErrors: Record<string, string> = {};
  const clientId = input.clientId.trim();
  const displayName = input.displayName.trim();
  const redirectUris = normalizeRedirectUris(input.redirectUris, fieldErrors);
  const allowedEndpointIds = normalizeAllowedEndpointIds(input.allowedEndpointIds, fieldErrors);
  const allowedResourceIds = normalizeAllowedResourceIds(input.allowedResourceIds, fieldErrors);
  const allowedPromptIds = normalizeAllowedPromptIds(input.allowedPromptIds, fieldErrors);

  if (!CLIENT_ID_PATTERN.test(clientId)) {
    fieldErrors.clientId = "Use 1-96 letters, numbers, dots, underscores, hyphens, or colons.";
  }
  if (displayName.length > 120) {
    fieldErrors.displayName = "Use 120 characters or fewer.";
  }
  validateClientTtl(input.clientCredentialsTtlSeconds, fieldErrors);

  if (Object.keys(fieldErrors).length) {
    throw new OAuthClientValidationError(fieldErrors);
  }

  return {
    clientId,
    displayName,
    enabled: input.enabled,
    redirectUris,
    clientCredentialsTtlSeconds: input.clientCredentialsTtlSeconds,
    allowedEndpointIds,
    allowedResourceIds,
    allowedPromptIds,
  };
}

export function validateOAuthClientUpdateInput(input: OAuthClientUpdateInput): OAuthClientUpdateInput {
  const fieldErrors: Record<string, string> = {};
  const output: OAuthClientUpdateInput = {};

  if (input.displayName !== undefined) {
    const displayName = input.displayName.trim();
    if (displayName.length > 120) {
      fieldErrors.displayName = "Use 120 characters or fewer.";
    }
    output.displayName = displayName;
  }
  if (input.redirectUris !== undefined) {
    output.redirectUris = normalizeRedirectUris(input.redirectUris, fieldErrors);
  }
  if (input.allowedEndpointIds !== undefined) {
    output.allowedEndpointIds = normalizeAllowedEndpointIds(input.allowedEndpointIds, fieldErrors);
  }
  if (input.allowedResourceIds !== undefined) {
    output.allowedResourceIds = normalizeAllowedResourceIds(input.allowedResourceIds, fieldErrors);
  }
  if (input.allowedPromptIds !== undefined) {
    output.allowedPromptIds = normalizeAllowedPromptIds(input.allowedPromptIds, fieldErrors);
  }
  if (input.clientCredentialsTtlSeconds !== undefined) {
    validateClientTtl(input.clientCredentialsTtlSeconds, fieldErrors);
    output.clientCredentialsTtlSeconds = input.clientCredentialsTtlSeconds;
  }
  if (input.enabled !== undefined) {
    output.enabled = input.enabled;
  }

  if (Object.keys(fieldErrors).length) {
    throw new OAuthClientValidationError(fieldErrors);
  }

  return output;
}
