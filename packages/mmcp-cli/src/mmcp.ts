import {
  buildMcpRequest,
  createAuthorizationHeaders,
  inspectMcpTarget,
  parseHeaderLines,
  parseJsonObject,
  parseKeyValueArgs,
  type BuildMcpRequestOptions,
  type InspectMcpTargetOptions,
  type InspectionResult,
  type JsonObject,
  type McpTransport,
} from "@minasoft/mcp-inspector-core";

type ParsedCli = {
  help: boolean;
  url?: string;
  request?: BuildMcpRequestOptions;
  inspect?: Omit<InspectMcpTargetOptions, "url" | "method" | "params">;
  format: "pretty" | "json";
  verbose: boolean;
};

const HELP = `mmcp - command line MCP inspector

Usage:
  mmcp tools list <url> [options]
  mmcp tools call <url> --name <tool> [--arg key=value] [--json-args '{...}']
  mmcp resources list <url> [options]
  mmcp resources read <url> --uri <uri>
  mmcp resources templates <url>
  mmcp prompts list <url>
  mmcp prompts get <url> --name <prompt> [--arg key=value] [--json-args '{...}']
  mmcp completion prompt <url> --name <prompt> --argument name=value
  mmcp completion resource <url> --uri <uri> --argument name=value
  mmcp raw <url> --method <mcp/method> [--params '{...}']

Options:
  --transport http|sse              Transport to use. Default: http
  --header "Name: Value"            Add request header. Repeatable
  --basic user:pass                 Add Basic Authorization header
  --bearer token                    Add Bearer Authorization header
  --protocol-version version        MCP protocol version header
  --insecure-tls                    Allow self-signed HTTPS certificates for HTTP transport
  --format pretty|json              Output format. Default: pretty
  --verbose                         Print all steps in pretty mode
  --help                            Show this help
`;

export async function main(argv: string[]): Promise<void> {
  const parsed = parseCli(argv);
  if (parsed.help) {
    console.log(HELP.trimEnd());
    return;
  }
  if (!parsed.url || !parsed.request) throw new Error("Missing MCP command. Run mmcp --help.");
  const payload = buildMcpRequest(parsed.request);
  const result = await inspectMcpTarget({
    url: parsed.url,
    method: payload.method,
    params: payload.params,
    ...parsed.inspect,
  });
  if (parsed.format === "json") {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatPretty(result, parsed.verbose));
  }
  if (!result.ok) process.exitCode = 2;
}

export function parseCli(argv: string[]): ParsedCli {
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    return { help: true, format: "pretty", verbose: false };
  }

  const family = argv[0];
  if (family === "raw") {
    const url = argv[1];
    if (!url) throw new Error("MCP endpoint URL is required.");
    const options = parseOptions(argv.slice(2));
    const inspect = buildInspectOptions(options);
    const format = options.format === "json" ? "json" : "pretty";
    const verbose = Boolean(options.verbose);
    return {
      help: false,
      url,
      inspect,
      format,
      verbose,
      request: {
        family: "raw",
        action: "raw",
        method: requireOption(options.method, "--method"),
        params: parseJsonObject(typeof options.params === "string" ? options.params : undefined, "params"),
      },
    };
  }

  const [, actionOrUrl, maybeUrl, ...rest] = argv;
  const options = parseOptions(rest);
  const inspect = buildInspectOptions(options);
  const format = options.format === "json" ? "json" : "pretty";
  const verbose = Boolean(options.verbose);

  if (!maybeUrl) throw new Error("MCP endpoint URL is required.");
  const url = maybeUrl;
  const args = mergeArgs(options);

  if (family === "tools") {
    if (actionOrUrl === "list") return command(url, inspect, format, verbose, { family: "tools", action: "list" });
    if (actionOrUrl === "call") {
      return command(url, inspect, format, verbose, {
        family: "tools",
        action: "call",
        name: requireOption(options.name, "--name"),
        args,
      });
    }
  }

  if (family === "resources") {
    if (actionOrUrl === "list") return command(url, inspect, format, verbose, { family: "resources", action: "list" });
    if (actionOrUrl === "read") {
      return command(url, inspect, format, verbose, {
        family: "resources",
        action: "read",
        uri: requireOption(options.uri, "--uri"),
      });
    }
    if (actionOrUrl === "templates") return command(url, inspect, format, verbose, { family: "resources", action: "templates" });
  }

  if (family === "prompts") {
    if (actionOrUrl === "list") return command(url, inspect, format, verbose, { family: "prompts", action: "list" });
    if (actionOrUrl === "get") {
      return command(url, inspect, format, verbose, {
        family: "prompts",
        action: "get",
        name: requireOption(options.name, "--name"),
        args,
      });
    }
  }

  if (family === "completion") {
    if (actionOrUrl === "prompt") {
      return command(url, inspect, format, verbose, {
        family: "completion",
        action: "prompt",
        name: requireOption(options.name, "--name"),
        argument: parseArgument(requireOption(options.argument, "--argument")),
      });
    }
    if (actionOrUrl === "resource") {
      return command(url, inspect, format, verbose, {
        family: "completion",
        action: "resource",
        uri: requireOption(options.uri, "--uri"),
        argument: parseArgument(requireOption(options.argument, "--argument")),
      });
    }
  }

  throw new Error(`Unsupported command: ${argv.slice(0, 2).join(" ")}`);
}

function command(
  url: string,
  inspect: ParsedCli["inspect"],
  format: ParsedCli["format"],
  verbose: boolean,
  request: BuildMcpRequestOptions,
): ParsedCli {
  return { help: false, url, inspect, format, verbose, request };
}

function parseOptions(argv: string[]): Record<string, string | string[] | boolean> {
  const parsed: Record<string, string | string[] | boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    if (key === "verbose" || key === "insecure-tls") {
      parsed[toCamel(key)] = true;
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`Missing value for --${key}.`);
    index += 1;
    const normalized = toCamel(key);
    if (normalized === "header" || normalized === "arg") {
      const existing = parsed[normalized];
      parsed[normalized] = Array.isArray(existing) ? [...existing, value] : [value];
    } else {
      parsed[normalized] = value;
    }
  }
  return parsed;
}

function buildInspectOptions(options: Record<string, string | string[] | boolean>): ParsedCli["inspect"] {
  const rawHeaders = Array.isArray(options.header) ? parseHeaderLines(options.header) : {};
  const headers = createAuthorizationHeaders({
    headers: rawHeaders,
    basic: typeof options.basic === "string" ? options.basic : undefined,
    bearer: typeof options.bearer === "string" ? options.bearer : undefined,
  });
  const transport = parseTransport(options.transport);
  return {
    transport,
    headers,
    protocolVersion: typeof options.protocolVersion === "string" ? options.protocolVersion : undefined,
    insecureTls: Boolean(options.insecureTls),
  };
}

function parseTransport(value: string | string[] | boolean | undefined): McpTransport {
  if (value === undefined) return "http";
  if (value === "http" || value === "sse") return value;
  throw new Error("--transport must be either http or sse.");
}

function mergeArgs(options: Record<string, string | string[] | boolean>): JsonObject {
  const fromJson = parseJsonObject(typeof options.jsonArgs === "string" ? options.jsonArgs : undefined, "json-args");
  const fromPairs = parseKeyValueArgs(Array.isArray(options.arg) ? options.arg : []);
  return { ...fromJson, ...fromPairs };
}

function parseArgument(value: string): { name: string; value?: string } {
  const separator = value.indexOf("=");
  if (separator <= 0) return { name: value };
  return { name: value.slice(0, separator), value: value.slice(separator + 1) };
}

function requireOption(value: string | string[] | boolean | undefined, label: string): string {
  if (typeof value !== "string" || !value) throw new Error(`${label} is required.`);
  return value;
}

function toCamel(value: string): string {
  return value.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function formatPretty(result: InspectionResult, verbose: boolean): string {
  const lines = [
    `Target: ${result.targetUrl}`,
    `Transport: ${result.transport}`,
    `Status: ${result.ok ? "pass" : "fail"} (${result.summary.pass} pass, ${result.summary.warn} warn, ${result.summary.fail} fail)`,
    "",
  ];
  for (const step of result.steps) {
    lines.push(`${symbolFor(step.status)} ${step.name}${step.response ? ` - HTTP ${step.response.status} in ${step.response.elapsedMs}ms` : ""}`);
    if (step.evidence) lines.push(`  ${step.evidence}`);
    if (verbose && step.response) lines.push(`  ${JSON.stringify(step.response.body, null, 2).replaceAll("\n", "\n  ")}`);
  }
  if (!verbose && result.result) {
    lines.push("");
    lines.push("Result:");
    lines.push(JSON.stringify(result.result, null, 2));
  }
  return lines.join("\n");
}

function symbolFor(status: string): string {
  if (status === "pass") return "PASS";
  if (status === "warn") return "WARN";
  if (status === "skip") return "SKIP";
  return "FAIL";
}
