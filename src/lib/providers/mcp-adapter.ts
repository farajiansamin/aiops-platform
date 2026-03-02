import { type ToolProvider } from "./base";

/**
 * MCP Adapter layer for future extraction of tool providers into standalone
 * MCP (Model Context Protocol) servers.
 *
 * Current capabilities:
 * - toMCPServerConfig: generates config metadata for exposing a ToolProvider as MCP
 * - fromRemoteTools: wraps arbitrary tool records as a ToolProvider (for consuming remote MCP)
 *
 * When you're ready to extract a provider into a standalone MCP server,
 * use toMCPServerConfig() to generate the manifest, then deploy the provider
 * as a separate service exposing SSE or stdio transport.
 */

export interface MCPServerConfig {
  name: string;
  description: string;
  version: string;
  tools: Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }>;
}

export class MCPAdapter {
  static toMCPServerConfig(provider: ToolProvider): MCPServerConfig {
    const tools = provider.getTools();
    return {
      name: provider.name,
      description: provider.description,
      version: "1.0.0",
      tools: Object.entries(tools).map(([name, toolDef]) => ({
        name,
        description: (toolDef as { description?: string }).description ?? "",
        inputSchema:
          (toolDef as { parameters?: Record<string, unknown> }).parameters ??
          {},
      })),
    };
  }

  static fromRemoteTools(
    name: string,
    description: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: Record<string, any>,
  ): ToolProvider {
    return {
      name,
      description,
      getTools: () => tools,
      healthCheck: async () => true,
    };
  }
}
