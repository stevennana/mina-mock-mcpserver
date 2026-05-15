import { type BuildMcpRequestOptions, type InspectMcpTargetOptions } from "@minasoft/mcp-inspector-core";
type ParsedCli = {
    help: boolean;
    url?: string;
    request?: BuildMcpRequestOptions;
    inspect?: Omit<InspectMcpTargetOptions, "url" | "method" | "params">;
    format: "pretty" | "json";
    verbose: boolean;
};
export declare function main(argv: string[]): Promise<void>;
export declare function parseCli(argv: string[]): ParsedCli;
export {};
//# sourceMappingURL=mmcp.d.ts.map