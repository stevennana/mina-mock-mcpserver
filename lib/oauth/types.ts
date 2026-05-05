export const DEFAULT_OAUTH_USER_ID = "oauth_user_default";
export const DEFAULT_OAUTH_USERNAME = "default";
export const DEFAULT_OAUTH_PASSWORD = "default";
export const DEFAULT_OAUTH_ACCESS_TOKEN_TTL_SECONDS = 3600;
export const DEFAULT_OAUTH_CLIENT_ID = "oauth_client_default";
export const DEFAULT_OAUTH_CLIENT_IDENTIFIER = "default";
export const DEFAULT_OAUTH_CLIENT_SECRET = "default";
export const DEFAULT_OAUTH_CLIENT_DISPLAY_NAME = "Default OAuth client";
export const DEFAULT_OAUTH_CLIENT_REDIRECT_URI = "http://localhost:3000/oauth/callback";
export const DEFAULT_OAUTH_CLIENT_CREDENTIALS_TTL_SECONDS = 3600;
export const OAUTH_AUTHORIZATION_CODE_TTL_SECONDS = 300;
export const OAUTH_LOGIN_TICKET_TTL_SECONDS = 300;

export const OAUTH_ACCESS_TOKEN_TTL_PRESETS = [
  { label: "15 minutes", seconds: 900 },
  { label: "1 hour", seconds: 3600 },
  { label: "8 hours", seconds: 28800 },
  { label: "24 hours", seconds: 86400 },
] as const;

export const OAUTH_CLIENT_CREDENTIALS_TTL_PRESETS = [
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

export type OAuthClientEndpointOption = {
  id: string;
  name: string;
  title: string;
  enabled: boolean;
};

export type OAuthClientSummary = {
  id: string;
  clientId: string;
  displayName: string;
  enabled: boolean;
  builtIn: boolean;
  redirectUris: string[];
  clientCredentialsTtlSeconds: number;
  allowedEndpointIds: string[];
  allowedEndpoints: OAuthClientEndpointOption[];
  createdAt: string;
  updatedAt: string;
};

export type OAuthClientListResult = {
  total: number;
  enabled: number;
  disabled: number;
  clients: OAuthClientSummary[];
  endpointOptions: OAuthClientEndpointOption[];
  ttlPresets: typeof OAUTH_CLIENT_CREDENTIALS_TTL_PRESETS;
};

export type OAuthClientCreateInput = {
  clientId: string;
  displayName: string;
  enabled: boolean;
  redirectUris: string[];
  clientCredentialsTtlSeconds: number;
  allowedEndpointIds: string[];
};

export type OAuthClientUpdateInput = {
  displayName?: string;
  enabled?: boolean;
  redirectUris?: string[];
  clientCredentialsTtlSeconds?: number;
  allowedEndpointIds?: string[];
};

export type OAuthClientSecretResult = {
  client: OAuthClientSummary;
  clientSecret: string;
};

export class OAuthClientValidationError extends Error {
  constructor(public readonly fieldErrors: Record<string, string>) {
    super("OAuth client validation failed.");
  }
}

export class OAuthClientBuiltInError extends Error {
  constructor(public readonly action: "update" | "delete" | "regenerateSecret") {
    super("Built-in OAuth client cannot be changed.");
  }
}

export class OAuthClientNotFoundError extends Error {
  constructor() {
    super("OAuth client not found.");
  }
}

export type OAuthAuthorizeRequest = {
  responseType: string;
  clientId: string;
  redirectUri: string;
  state: string | null;
  resource: string;
};

export type OAuthAuthorizeContext = {
  request: OAuthAuthorizeRequest;
  client: OAuthClientSummary;
  codeTtlSeconds: number;
};

export type OAuthConsentContext = OAuthAuthorizeContext & {
  user: OAuthUserSummary;
  loginTicket: string;
};

export type OAuthAuthorizationCodeSummary = {
  id: string;
  code: string;
  oauthClientId: string;
  oauthUserId: string;
  redirectUri: string;
  resource: string;
  state: string | null;
  selectedEndpointIds: string[];
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
};

export class OAuthAuthorizeRequestError extends Error {
  constructor(public readonly code: string, message: string, public readonly field?: string) {
    super(message);
  }
}

export class OAuthLoginError extends Error {
  constructor(public readonly code: "invalid_user" | "invalid_ticket" | "invalid_selection", message: string) {
    super(message);
  }
}
