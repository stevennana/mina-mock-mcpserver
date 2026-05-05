export const DEFAULT_OAUTH_USER_ID = "oauth_user_default";
export const DEFAULT_OAUTH_USERNAME = "default";
export const DEFAULT_OAUTH_PASSWORD = "default";
export const DEFAULT_OAUTH_ACCESS_TOKEN_TTL_SECONDS = 3600;

export const OAUTH_ACCESS_TOKEN_TTL_PRESETS = [
  { label: "15 minutes", seconds: 900 },
  { label: "1 hour", seconds: 3600 },
  { label: "8 hours", seconds: 28800 },
  { label: "24 hours", seconds: 86400 },
] as const;

export type OAuthUserSummary = {
  id: string;
  username: string;
  enabled: boolean;
  builtIn: boolean;
  accessTokenTtlSeconds: number;
  createdAt: string;
  updatedAt: string;
};

export type OAuthUserListResult = {
  total: number;
  enabled: number;
  disabled: number;
  users: OAuthUserSummary[];
  ttlPresets: typeof OAUTH_ACCESS_TOKEN_TTL_PRESETS;
};

export type OAuthUserCreateInput = {
  username: string;
  password: string;
  enabled: boolean;
  accessTokenTtlSeconds: number;
};

export type OAuthUserUpdateInput = {
  password?: string | null;
  enabled?: boolean;
  accessTokenTtlSeconds?: number;
};

export class OAuthUserValidationError extends Error {
  constructor(public readonly fieldErrors: Record<string, string>) {
    super("OAuth user validation failed.");
  }
}

export class OAuthUserBuiltInError extends Error {
  constructor(public readonly action: "update" | "delete") {
    super("Built-in OAuth user cannot be changed.");
  }
}

export class OAuthUserNotFoundError extends Error {
  constructor() {
    super("OAuth user not found.");
  }
}
