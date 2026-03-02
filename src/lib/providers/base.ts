import { type Tool } from "ai";

export type AnyTool = Tool;

export interface ToolProvider {
  readonly name: string;
  readonly description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getTools(): Record<string, any>;
  healthCheck(): Promise<boolean>;
}

export class ToolProviderRegistry {
  private providers = new Map<string, ToolProvider>();

  register(provider: ToolProvider): void {
    this.providers.set(provider.name, provider);
  }

  unregister(name: string): void {
    this.providers.delete(name);
  }

  get(name: string): ToolProvider | undefined {
    return this.providers.get(name);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAll(): Record<string, any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allTools: Record<string, any> = {};
    for (const provider of this.providers.values()) {
      const tools = provider.getTools();
      for (const [toolName, toolDef] of Object.entries(tools)) {
        allTools[`${provider.name}_${toolName}`] = toolDef;
      }
    }
    return allTools;
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  async healthCheckAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    for (const [name, provider] of this.providers.entries()) {
      try {
        results[name] = await provider.healthCheck();
      } catch {
        results[name] = false;
      }
    }
    return results;
  }
}

export const registry = new ToolProviderRegistry();
