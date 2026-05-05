export const DEFAULT_BASIC_USER_ID = "basic_user_default";
export const DEFAULT_BASIC_USERNAME = "default";
export const DEFAULT_BASIC_PASSWORD = "default";

export type BasicUserSummary = {
  id: string;
  username: string;
  enabled: boolean;
  builtIn: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BasicUserListResult = {
  total: number;
  enabled: number;
  disabled: number;
  users: BasicUserSummary[];
};

export type BasicUserCreateInput = {
  username: string;
  password: string;
  enabled: boolean;
};

export type BasicUserUpdateInput = {
  password?: string | null;
  enabled?: boolean;
};

export class BasicUserValidationError extends Error {
  constructor(public readonly fieldErrors: Record<string, string>) {
    super("Basic user validation failed.");
  }
}

export class BasicUserBuiltInError extends Error {
  constructor(public readonly action: "update" | "delete") {
    super("Built-in Basic user cannot be changed.");
  }
}

export class BasicUserNotFoundError extends Error {
  constructor() {
    super("Basic user not found.");
  }
}
