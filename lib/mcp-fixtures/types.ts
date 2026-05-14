export type McpFixtureContent = {
  textContent?: string | null;
  blobContentBase64?: string | null;
};

export type McpFixtureTemplateContent = {
  textTemplate?: string | null;
  blobTemplateBase64?: string | null;
};

export type McpResourceInput = {
  uri: string;
  name: string;
  title?: string;
  description?: string;
  mimeType: string;
  enabled: boolean;
  annotationsJson?: string | null;
} & McpFixtureContent;

export type McpResourceSummary = {
  id: string;
  uri: string;
  name: string;
  title: string;
  description: string;
  mimeType: string;
  enabled: boolean;
  protectedDefault: boolean;
  updatedAt: string;
};

export type McpResourceDetail = McpResourceSummary & {
  textContent: string | null;
  blobContentBase64: string | null;
  annotationsJson: string | null;
};

export type McpResourceTemplateArgumentInput = {
  name: string;
  description?: string;
  required?: boolean;
  sampleValueJson?: string | null;
};

export type McpCompletionCandidateInput = {
  argumentName: string;
  value: string;
  label?: string;
};

export type McpResourceTemplateInput = {
  uriTemplate: string;
  name: string;
  title?: string;
  description?: string;
  mimeType: string;
  enabled: boolean;
  annotationsJson?: string | null;
  arguments: McpResourceTemplateArgumentInput[];
  completionCandidates: McpCompletionCandidateInput[];
} & McpFixtureTemplateContent;

export type McpResourceTemplateSummary = {
  id: string;
  uriTemplate: string;
  name: string;
  title: string;
  description: string;
  mimeType: string;
  enabled: boolean;
  protectedDefault: boolean;
  argumentCount: number;
  completionCandidateCount: number;
  updatedAt: string;
};

export type McpResourceTemplateDetail = McpResourceTemplateSummary & {
  textTemplate: string | null;
  blobTemplateBase64: string | null;
  annotationsJson: string | null;
  arguments: Array<McpResourceTemplateArgumentInput & { id: string; position: number; required: boolean }>;
  completionCandidates: Array<McpCompletionCandidateInput & { id: string; position: number; label: string }>;
};

export type McpPromptArgumentInput = {
  name: string;
  title?: string;
  description?: string;
  required: boolean;
};

export type McpPromptMessageRole = "user" | "assistant";

export type McpPromptMessageInput = {
  role: McpPromptMessageRole;
  textTemplate?: string | null;
  resourceUri?: string | null;
  resourceMimeType?: string | null;
};

export type McpPromptInput = {
  name: string;
  title?: string;
  description?: string;
  enabled: boolean;
  arguments: McpPromptArgumentInput[];
  messages: McpPromptMessageInput[];
  completionCandidates: McpCompletionCandidateInput[];
};

export type McpPromptSummary = {
  id: string;
  name: string;
  title: string;
  description: string;
  enabled: boolean;
  protectedDefault: boolean;
  argumentCount: number;
  messageCount: number;
  completionCandidateCount: number;
  updatedAt: string;
};

export type McpPromptDetail = McpPromptSummary & {
  arguments: Array<McpPromptArgumentInput & { id: string; position: number; title: string; description: string }>;
  messages: Array<McpPromptMessageInput & { id: string; position: number; textTemplate: string | null; resourceUri: string | null; resourceMimeType: string | null }>;
  completionCandidates: Array<McpCompletionCandidateInput & { id: string; position: number; label: string }>;
};

export type McpFixtureListResult<T> = {
  total: number;
  enabled: number;
  disabled: number;
  items: T[];
};

export type McpResourceRuntimeRead = {
  uri: string;
  mimeType: string;
  textContent: string | null;
  blobContentBase64: string | null;
};

export class McpFixtureValidationError extends Error {
  constructor(public readonly fieldErrors: Record<string, string>) {
    super("MCP fixture validation failed");
  }
}

export class McpFixtureNotFoundError extends Error {
  constructor() {
    super("MCP fixture not found");
  }
}

export class McpFixtureProtectedDefaultError extends Error {
  constructor(public readonly fixtureType: "resource" | "resource_template" | "prompt", public readonly action: "update" | "delete") {
    super("Protected default MCP fixture cannot be changed");
  }
}
