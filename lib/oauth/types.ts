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
export const OAUTH_JWT_ALGORITHM = "RS256";
export const OAUTH_JWT_KEY_ID = "mcp-mock-dev-rs256-1";
export const DEFAULT_OAUTH_ISSUER = "http://localhost:3000";
export const DEFAULT_OAUTH_PRIVATE_KEY_PEM = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAxAIjGddtMHg0fsCV/+yvH8rg73MhhgGIB9pO+HJAZBMeurqK
w9jan83Zlc1JcBU5l0o0WMR6kZcakRB35qb1qE2bbck0UVdFutT99X8GQhqi66xO
4AZ6r8z4i0nPZko0Xt4IrP/Kw+hOJCFqEW6i/n14xbC1yO/KtzSnEq+Q9qOutJtW
QLPm5VepcaEZMI6bu29YvMpqsQF4g6GhMe6rQGs6BKfHo6aGzz4GCFPK7HZrTP5s
H3EgwFZ2ckei4X6/hCFACOpamTxAnqEscGU4pikJ0bQEP7V0xkmpidT9KrKr0a/X
de+onF65v7Kr8q2NKK0mh+Q4VFbCNa2dG0X6TwIDAQABAoIBAQCeVUudeFQPr0pY
iaGh1sOwXuZNByexZFNKZKMeNsylCnzsQfwOMIKKTHLTe70y+TJIb/zRKAYKzZD8
Vd1FSOFwTyCbEslcW69MOPnc8ftQMswgrFQay6EXme+8NKeA7bhYWeuQNCDLGEDn
FsbjxgeMpDaHGzP9WRbb34CGq6PiVvPo4IVFhs1deUmyVUFTnsIfofu40vodmiNY
NqEquhzOOKPL37eH0ps8nHL9JWAhlYlUSIU7ekgjweL/5BESlL3vX+Oo+uPHotIq
HG0AhcXxX2HXp7h9LGNYbsx1lHcmUmVzKqJOkXYJrp+4QppcIS1Y8XJ70EN5ozx+
xJ+zlv7hAoGBAPAMbtZdjw6Rr3GylYps4vL5j1HgQd/PQWSkaeyFohRubVDlIN60
v7ufH1xOP/JxrTm8665EqX/978MO7KNuNzh8bFIyOsaLxwxcRvtPQYj8kZG3/3up
fLzICUOd0eohuL1MuVhaf+Dom8nVl/uW95zgGVwQqbQ5elfIVl77ArdTAoGBANEI
hHqYylibHYjy1JtaJ+1kkM1rZ4yP1TvhacIDTlAaGCEoBVEnVUOefY9a6O/8aYyo
aqp+HItHeAS3Igxlp0VmYVW0Vx7muKSslscC1dvYYAlyHOfiO+Nuy8vbGiCUrkih
FjEmhWb5RpiHnpzKI+AGgjYQFIzC4KQ2mH4rI72VAoGBAMKbocPiR5ctHsoTWM7H
ZdpL3hgnseALO12nOUSKNhNQTwl1KIfEi2hFIXyI56ja5e/YLE201qGwMg+16ry4
HsaJgJvGowXRzgZETTtyTpQLBszXGaWci0bU+UW7DbI9snKtX9m0TNX+XkZsBnHu
O0IQIB8WVy6IJppCDVulLdeHAoGASp9jy/BnrCIT9SPbSmpw/op8Nxk0qjVexjW+
b4iGmIn4Oz3yR/pmsfEOmfK2XZYaiCBHk/3Zas9kxSoreYmAoYHfFZ1/zIRJPmBu
ozUb65PfFQAr2YwmHRccofXh6eeqIDuBlKJP1WcAEMu5j/eJvxwTuAEdlPKtB3KG
FeSIqdECgYA4HkiNFs0mPkv5F2nGv42wQkznw9Vh7kazqWKIDDil12ubj6KyXdd/
V2RkTFFdlxnMBU+AsKJumfaWO3QGe9p2KdispGMsEOR1Moy1vKHuH6RvwsCJFF7i
Jcffckhd4R6kO9uS7d3wr+fCqIbqRibWZjgXNt+Ib3PwNedjQoU+TA==
-----END RSA PRIVATE KEY-----`;

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

export type OAuthClientResourceOption = {
  id: string;
  uri: string;
  name: string;
  title: string;
  enabled: boolean;
};

export type OAuthClientResourceTemplateOption = {
  id: string;
  uriTemplate: string;
  name: string;
  title: string;
  enabled: boolean;
};

export type OAuthClientPromptOption = {
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
  allowedResourceIds: string[];
  allowedResources: OAuthClientResourceOption[];
  allowedResourceTemplateIds: string[];
  allowedResourceTemplates: OAuthClientResourceTemplateOption[];
  allowedPromptIds: string[];
  allowedPrompts: OAuthClientPromptOption[];
  createdAt: string;
  updatedAt: string;
};

export type OAuthClientListResult = {
  total: number;
  enabled: number;
  disabled: number;
  clients: OAuthClientSummary[];
  endpointOptions: OAuthClientEndpointOption[];
  resourceOptions: OAuthClientResourceOption[];
  resourceTemplateOptions: OAuthClientResourceTemplateOption[];
  promptOptions: OAuthClientPromptOption[];
  ttlPresets: typeof OAUTH_CLIENT_CREDENTIALS_TTL_PRESETS;
};

export type OAuthClientCreateInput = {
  clientId: string;
  displayName: string;
  enabled: boolean;
  redirectUris: string[];
  clientCredentialsTtlSeconds: number;
  allowedEndpointIds: string[];
  allowedResourceIds?: string[];
  allowedResourceTemplateIds?: string[];
  allowedPromptIds?: string[];
};

export type OAuthClientUpdateInput = {
  displayName?: string;
  enabled?: boolean;
  redirectUris?: string[];
  clientCredentialsTtlSeconds?: number;
  allowedEndpointIds?: string[];
  allowedResourceIds?: string[];
  allowedResourceTemplateIds?: string[];
  allowedPromptIds?: string[];
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
  codeChallenge: string | null;
  codeChallengeMethod: string | null;
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
  codeChallenge: string | null;
  codeChallengeMethod: string | null;
  selectedEndpointIds: string[];
  selectedResourceIds: string[];
  selectedResourceTemplateIds: string[];
  selectedPromptIds: string[];
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

export type OAuthTokenExchangeInput = {
  grantType: string;
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
  codeVerifier?: string;
  scope?: string;
  resource?: string;
  issuer?: string;
  now?: Date;
};

export type OAuthAccessTokenClaims = {
  iss: string;
  aud: string;
  resource: string;
  sub: string;
  client_id: string;
  grant_type: "authorization_code" | "client_credentials";
  iat: number;
  exp: number;
  jti: string;
  scope: string;
  endpoint_permissions: string[];
  resource_permissions: string[];
  resource_template_permissions: string[];
  prompt_permissions: string[];
};

export type OAuthTokenExchangeResult = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
};

export type OAuthIssuedTokenStatus = "active" | "expired" | "revoked";

export type OAuthIssuedTokenEndpointPermission = {
  id: string;
  name: string | null;
  title: string | null;
  enabled: boolean | null;
};

export type OAuthIssuedTokenResourcePermission = {
  id: string;
  uri: string | null;
  name: string | null;
  title: string | null;
  enabled: boolean | null;
};

export type OAuthIssuedTokenResourceTemplatePermission = {
  id: string;
  uriTemplate: string | null;
  name: string | null;
  title: string | null;
  enabled: boolean | null;
};

export type OAuthIssuedTokenPromptPermission = {
  id: string;
  name: string | null;
  title: string | null;
  enabled: boolean | null;
};

export type OAuthIssuedTokenSummary = {
  id: string;
  jti: string;
  status: OAuthIssuedTokenStatus;
  subject: string;
  clientId: string;
  oauthClientId: string;
  oauthUserId: string | null;
  username: string | null;
  grantType: OAuthAccessTokenClaims["grant_type"];
  scope: string;
  resource: string;
  issuedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  endpointPermissionCount: number;
  resourcePermissionCount: number;
  resourceTemplatePermissionCount: number;
  promptPermissionCount: number;
};

export type OAuthIssuedTokenDetail = OAuthIssuedTokenSummary & {
  claims: OAuthAccessTokenClaims;
  endpoint_permissions: OAuthIssuedTokenEndpointPermission[];
  resource_permissions: OAuthIssuedTokenResourcePermission[];
  resource_template_permissions: OAuthIssuedTokenResourceTemplatePermission[];
  prompt_permissions: OAuthIssuedTokenPromptPermission[];
};

export type OAuthIssuedTokenListFilters = {
  status?: OAuthIssuedTokenStatus | "all";
  subject?: string;
  client?: string;
  grantType?: OAuthAccessTokenClaims["grant_type"] | "all";
};

export type OAuthIssuedTokenListResult = {
  total: number;
  active: number;
  expired: number;
  revoked: number;
  tokens: OAuthIssuedTokenSummary[];
};

export class OAuthIssuedTokenNotFoundError extends Error {
  constructor() {
    super("OAuth issued token not found.");
  }
}

export class OAuthTokenError extends Error {
  constructor(
    public readonly code: "invalid_request" | "invalid_client" | "invalid_grant" | "unsupported_grant_type",
    message: string,
    public readonly status = code === "invalid_client" ? 401 : 400,
  ) {
    super(message);
  }
}
