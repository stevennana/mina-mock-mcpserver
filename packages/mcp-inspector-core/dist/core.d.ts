import type { AuthorizationOptions, BuildMcpRequestOptions, InspectMcpTargetOptions, InspectionResult, JsonObject } from "./types.js";
type JsonRpcPayload = {
    jsonrpc: "2.0";
    id?: string | number | null;
    method: string;
    params?: JsonObject;
};
export declare function parseJsonObject(value: string | undefined, label?: string): JsonObject;
export declare function parseKeyValueArgs(values?: string[]): JsonObject;
export declare function parseHeaderLines(values?: string[]): Record<string, string>;
export declare function createAuthorizationHeaders(options?: AuthorizationOptions): Record<string, string>;
export declare function redactHeaders(headers?: Record<string, string>): Record<string, string>;
export declare function buildMcpRequest(options: BuildMcpRequestOptions): JsonRpcPayload;
export declare function inspectMcpTarget(options: InspectMcpTargetOptions): Promise<InspectionResult>;
export {};
//# sourceMappingURL=core.d.ts.map