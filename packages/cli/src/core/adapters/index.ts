/**
 * 🔮 OMGBUILD Tool Adapters
 * Export all adapters and utilities
 */

// Base
export * from './base-adapter';

// Specific Adapters
export * from './claude-code';
export * from './codex';
export * from './gemini';
export * from './aider';

// Re-export factories
import { createClaudeCodeAdapter, ClaudeCodeAdapter } from './claude-code';
import { createCodexAdapter, CodexAdapter } from './codex';
import { createGeminiAdapter, GeminiAdapter } from './gemini';
import { createAiderAdapter, createGenericAdapter, AiderAdapter, GenericCLIAdapter } from './aider';
import { ToolRegistry, BaseToolAdapter, ToolConfig, ToolType } from './base-adapter';

// ============================================================================
// ADAPTER FACTORY
// ============================================================================

/**
 * Create an adapter by type
 */
export function createAdapter(
  type: ToolType,
  config?: Partial<ToolConfig>
): BaseToolAdapter {
  switch (type) {
    case 'claude-code':
      return createClaudeCodeAdapter(config);
    case 'codex':
      return createCodexAdapter(config);
    case 'gemini':
      return createGeminiAdapter(config);
    case 'aider':
      return createAiderAdapter(config);
    default:
      throw new Error(`Unknown adapter type: ${type}`);
  }
}

/**
 * Create a pre-configured tool registry with all standard adapters
 */
export async function createDefaultRegistry(): Promise<ToolRegistry> {
  const registry = new ToolRegistry();

  // Register all standard adapters
  const adapters = [
    createClaudeCodeAdapter(),
    createCodexAdapter(),
    createGeminiAdapter(),
    createAiderAdapter(),
  ];

  for (const adapter of adapters) {
    await adapter.initialize();
    registry.register(adapter);
  }

  return registry;
}

/**
 * Discover available tools on the system
 */
export async function discoverTools(): Promise<{
  available: Array<{ name: string; type: ToolType; version: string | null }>;
  unavailable: Array<{ name: string; type: ToolType; installHint: string }>;
}> {
  const tools: Array<{
    adapter: BaseToolAdapter;
    installHint: string;
  }> = [
    {
      adapter: createClaudeCodeAdapter(),
      installHint: 'npm install -g @anthropic-ai/claude-code',
    },
    {
      adapter: createCodexAdapter(),
      installHint: 'npm install -g @openai/codex',
    },
    {
      adapter: createGeminiAdapter(),
      installHint: 'Install Google Cloud SDK with Gemini CLI',
    },
    {
      adapter: createAiderAdapter(),
      installHint: 'pip install aider-chat',
    },
  ];

  const available: Array<{ name: string; type: ToolType; version: string | null }> = [];
  const unavailable: Array<{ name: string; type: ToolType; installHint: string }> = [];

  for (const { adapter, installHint } of tools) {
    const isAvailable = await adapter.checkAvailability();
    
    if (isAvailable) {
      const version = await adapter.getVersion();
      available.push({
        name: adapter.name,
        type: adapter.type,
        version,
      });
    } else {
      unavailable.push({
        name: adapter.name,
        type: adapter.type,
        installHint,
      });
    }
  }

  return { available, unavailable };
}
