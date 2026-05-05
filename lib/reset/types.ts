export const RESET_CONFIRMATION_TEXT = "RESET DEFAULTS";

export type ResetInput = {
  rootPassword?: string | null;
  confirmation?: string | null;
};

export type ResetResult = {
  deletedEndpoints: number;
  seededEndpoints: number;
  deletedBasicUsers: number;
  seededBasicUsers: number;
  deletedOAuthUsers: number;
  seededOAuthUsers: number;
  deletedOAuthClients: number;
  seededOAuthClients: number;
};

export class ResetAuthorizationError extends Error {
  constructor(public readonly reason: "missing_confirmation" | "invalid_confirmation" | "invalid_root_password") {
    super("Reset authorization failed");
  }
}
