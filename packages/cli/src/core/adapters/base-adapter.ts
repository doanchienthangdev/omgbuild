/**
 * 🔮 OMGBUILD Tool Adapters - Base Interface
 * Abstract interface for external AI CLI tools
 */

import { EventEmitter } from 'events';

// ============================================================================
// TYPES
// ============================================================================

export type ToolType = 
  | 'claude-code'
  | 'codex'
  | 'gemini'
  | 'aider'
  | 'cursor'
  | 'copilot'
  | 'cody'
  | 'continue'
  | 'generic';

export type TaskType =
  | 'analyze'
  | 'code'
  | 'test'
  | 'review'
  | 'refactor'
  | 'debug'
  | 'document'
  | 'explain'
  | 'chat'
  | 'shell'
  | 'custom';

export interface ToolCapabilities {
  canCode: boolean;
  canChat: boolean;
  canEdit: boolean;
  canExecuteShell: boolean;
  canReadFiles: boolean;
  canWriteFiles: boolean;
  canSearch: boolean;
  canBrowseWeb: boolean;
  supportsStreaming: boolean;
  supportsMultiFile: boolean;
  supportsProject: boolean;
}

export interface ToolConfig {
  name: string;
  type: ToolType;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  workingDir?: string;
  timeout?: number;
  capabilities: ToolCapabilities;
  routing?: {
    preferFor?: TaskType[];
    avoidFor?: TaskType[];
    priority?: number;
  };
}

export interface ExecutionContext {
  task: string;
  taskType: TaskType;
  projectRoot: string;
  omgbuildDir: string;
  files?: string[];
  previousOutput?: string;
  metadata?: Record<string, unknown>;
  memory?: {
    decisions: unknown[];
    patterns: unknown[];
    learnings: unknown[];
  };
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  artifacts?: {
    files: string[];
    code: string[];
    analysis?: unknown;
  };
  duration: number;
  tokensUsed?: number;
  toolUsed: string;
  metadata?: Record<string, unknown>;
}

export interface StreamCallbacks {
  onStart?: () => void;
  onOutput?: (chunk: string) => void;
  onError?: (error: string) => void;
  onComplete?: (result: ExecutionResult) => void;
}

// ============================================================================
// BASE ADAPTER CLASS
// ============================================================================

export abstract class BaseToolAdapter extends EventEmitter {
  protected config: ToolConfig;
  protected available: boolean = false;

  constructor(config: ToolConfig) {
    super();
    this.config = config;
  }

  /**
   * Get tool name
   */
  get name(): string {
    return this.config.name;
  }

  /**
   * Get tool type
   */
  get type(): ToolType {
    return this.config.type;
  }

  /**
   * Get tool capabilities
   */
  get capabilities(): ToolCapabilities {
    return this.config.capabilities;
  }

  /**
   * Check if tool is available
   */
  abstract checkAvailability(): Promise<boolean>;

  /**
   * Execute a task
   */
  abstract execute(context: ExecutionContext, callbacks?: StreamCallbacks): Promise<ExecutionResult>;

  /**
   * Build the command to execute
   */
  abstract buildCommand(context: ExecutionContext): { command: string; args: string[] };

  /**
   * Parse tool output into structured result
   */
  abstract parseOutput(output: string, context: ExecutionContext): ExecutionResult;

  /**
   * Get tool version
   */
  abstract getVersion(): Promise<string | null>;

  /**
   * Initialize tool (if needed)
   */
  async initialize(): Promise<void> {
    this.available = await this.checkAvailability();
  }

  /**
   * Check if tool supports a task type
   */
  supportsTask(taskType: TaskType): boolean {
    const { routing, capabilities } = this.config;

    // Check avoid list
    if (routing?.avoidFor?.includes(taskType)) {
      return false;
    }

    // Check capabilities based on task type
    switch (taskType) {
      case 'code':
      case 'refactor':
        return capabilities.canCode && capabilities.canWriteFiles;
      case 'analyze':
      case 'review':
      case 'explain':
        return capabilities.canReadFiles;
      case 'test':
        return capabilities.canCode && capabilities.canWriteFiles;
      case 'debug':
        return capabilities.canCode && capabilities.canExecuteShell;
      case 'document':
        return capabilities.canWriteFiles;
      case 'chat':
        return capabilities.canChat;
      case 'shell':
        return capabilities.canExecuteShell;
      default:
        return true;
    }
  }

  /**
   * Get priority for a task type
   */
  getPriority(taskType: TaskType): number {
    const { routing } = this.config;
    
    // Higher priority if preferred for this task
    if (routing?.preferFor?.includes(taskType)) {
      return (routing.priority || 50) + 50;
    }

    return routing?.priority || 50;
  }

  /**
   * Format task for this specific tool
   */
  formatTask(context: ExecutionContext): string {
    // Default implementation - can be overridden
    let prompt = context.task;

    // Add file context if available
    if (context.files && context.files.length > 0) {
      prompt += `\n\nFiles to work with:\n${context.files.join('\n')}`;
    }

    // Add memory context if available
    if (context.memory?.decisions.length) {
      prompt += `\n\nProject decisions to consider:\n${JSON.stringify(context.memory.decisions.slice(-5), null, 2)}`;
    }

    return prompt;
  }

  /**
   * Create execution result helper
   */
  protected createResult(
    success: boolean,
    output: string,
    duration: number,
    extras?: Partial<ExecutionResult>
  ): ExecutionResult {
    return {
      success,
      output,
      duration,
      toolUsed: this.name,
      ...extras,
    };
  }
}

// ============================================================================
// TOOL REGISTRY
// ============================================================================

export class ToolRegistry {
  private tools: Map<string, BaseToolAdapter> = new Map();

  /**
   * Register a tool adapter
   */
  register(adapter: BaseToolAdapter): void {
    this.tools.set(adapter.name, adapter);
  }

  /**
   * Get a tool by name
   */
  get(name: string): BaseToolAdapter | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAll(): BaseToolAdapter[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get available tools
   */
  async getAvailable(): Promise<BaseToolAdapter[]> {
    const available: BaseToolAdapter[] = [];
    
    for (const tool of this.tools.values()) {
      if (await tool.checkAvailability()) {
        available.push(tool);
      }
    }

    return available;
  }

  /**
   * Find best tool for a task
   */
  async findBestTool(taskType: TaskType): Promise<BaseToolAdapter | null> {
    const available = await this.getAvailable();
    
    // Filter tools that support this task
    const capable = available.filter(t => t.supportsTask(taskType));
    
    if (capable.length === 0) {
      return null;
    }

    // Sort by priority
    capable.sort((a, b) => b.getPriority(taskType) - a.getPriority(taskType));

    return capable[0];
  }

  /**
   * Get tools by capability
   */
  getByCapability(capability: keyof ToolCapabilities): BaseToolAdapter[] {
    return Array.from(this.tools.values()).filter(
      t => t.capabilities[capability]
    );
  }
}

// ============================================================================
// DEFAULT CAPABILITIES
// ============================================================================

export const DEFAULT_CAPABILITIES: Record<ToolType, ToolCapabilities> = {
  'claude-code': {
    canCode: true,
    canChat: true,
    canEdit: true,
    canExecuteShell: true,
    canReadFiles: true,
    canWriteFiles: true,
    canSearch: true,
    canBrowseWeb: true,
    supportsStreaming: true,
    supportsMultiFile: true,
    supportsProject: true,
  },
  'codex': {
    canCode: true,
    canChat: true,
    canEdit: true,
    canExecuteShell: true,
    canReadFiles: true,
    canWriteFiles: true,
    canSearch: false,
    canBrowseWeb: false,
    supportsStreaming: true,
    supportsMultiFile: true,
    supportsProject: true,
  },
  'gemini': {
    canCode: true,
    canChat: true,
    canEdit: true,
    canExecuteShell: true,
    canReadFiles: true,
    canWriteFiles: true,
    canSearch: true,
    canBrowseWeb: true,
    supportsStreaming: true,
    supportsMultiFile: true,
    supportsProject: true,
  },
  'aider': {
    canCode: true,
    canChat: true,
    canEdit: true,
    canExecuteShell: false,
    canReadFiles: true,
    canWriteFiles: true,
    canSearch: false,
    canBrowseWeb: false,
    supportsStreaming: true,
    supportsMultiFile: true,
    supportsProject: true,
  },
  'cursor': {
    canCode: true,
    canChat: true,
    canEdit: true,
    canExecuteShell: true,
    canReadFiles: true,
    canWriteFiles: true,
    canSearch: true,
    canBrowseWeb: true,
    supportsStreaming: true,
    supportsMultiFile: true,
    supportsProject: true,
  },
  'copilot': {
    canCode: true,
    canChat: true,
    canEdit: true,
    canExecuteShell: false,
    canReadFiles: true,
    canWriteFiles: true,
    canSearch: false,
    canBrowseWeb: false,
    supportsStreaming: true,
    supportsMultiFile: true,
    supportsProject: false,
  },
  'cody': {
    canCode: true,
    canChat: true,
    canEdit: true,
    canExecuteShell: false,
    canReadFiles: true,
    canWriteFiles: true,
    canSearch: true,
    canBrowseWeb: false,
    supportsStreaming: true,
    supportsMultiFile: true,
    supportsProject: true,
  },
  'continue': {
    canCode: true,
    canChat: true,
    canEdit: true,
    canExecuteShell: true,
    canReadFiles: true,
    canWriteFiles: true,
    canSearch: false,
    canBrowseWeb: false,
    supportsStreaming: true,
    supportsMultiFile: true,
    supportsProject: true,
  },
  'generic': {
    canCode: false,
    canChat: true,
    canEdit: false,
    canExecuteShell: false,
    canReadFiles: false,
    canWriteFiles: false,
    canSearch: false,
    canBrowseWeb: false,
    supportsStreaming: false,
    supportsMultiFile: false,
    supportsProject: false,
  },
};
