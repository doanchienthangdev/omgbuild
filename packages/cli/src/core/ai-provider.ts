/**
 * 🔮 OMGBUILD AI Provider Module
 * Multi-model AI abstraction layer
 */

import fs from 'fs-extra';
import path from 'path';

// ============================================================================
// TYPES
// ============================================================================

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  stopReason?: string;
}

export interface AIProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIProvider {
  name: string;
  chat(messages: AIMessage[], config?: Partial<AIProviderConfig>): Promise<AIResponse>;
  isAvailable(): Promise<boolean>;
}

// ============================================================================
// CLAUDE PROVIDER
// ============================================================================

export class ClaudeProvider implements AIProvider {
  name = 'claude';
  private apiKey: string | undefined;
  private baseUrl = 'https://api.anthropic.com/v1';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY;
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async chat(messages: AIMessage[], config?: Partial<AIProviderConfig>): Promise<AIResponse> {
    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY not set. Run: export ANTHROPIC_API_KEY=your-key');
    }

    const model = config?.model || 'claude-sonnet-4-20250514';
    const maxTokens = config?.maxTokens || 4096;

    // Convert messages to Claude format
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const chatMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemMessage,
        messages: chatMessages,
        temperature: config?.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      content: Array<{ text?: string }>;
      model: string;
      usage?: { input_tokens?: number; output_tokens?: number };
      stop_reason?: string;
    };

    return {
      content: data.content[0]?.text || '',
      model: data.model,
      usage: {
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
      },
      stopReason: data.stop_reason,
    };
  }
}

// ============================================================================
// OPENAI PROVIDER
// ============================================================================

export class OpenAIProvider implements AIProvider {
  name = 'openai';
  private apiKey: string | undefined;
  private baseUrl = 'https://api.openai.com/v1';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY;
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async chat(messages: AIMessage[], config?: Partial<AIProviderConfig>): Promise<AIResponse> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY not set. Run: export OPENAI_API_KEY=your-key');
    }

    const model = config?.model || 'gpt-4o';
    const maxTokens = config?.maxTokens || 4096;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature: config?.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      choices: Array<{ message?: { content?: string }; finish_reason?: string }>;
      model: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    return {
      content: data.choices[0]?.message?.content || '',
      model: data.model,
      usage: {
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
      },
      stopReason: data.choices[0]?.finish_reason,
    };
  }
}

// ============================================================================
// LOCAL/OLLAMA PROVIDER
// ============================================================================

export class OllamaProvider implements AIProvider {
  name = 'ollama';
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, { 
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async chat(messages: AIMessage[], config?: Partial<AIProviderConfig>): Promise<AIResponse> {
    const model = config?.model || 'llama3.1';

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        stream: false,
        options: {
          temperature: config?.temperature ?? 0.7,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as {
      message?: { content?: string };
      model: string;
      prompt_eval_count?: number;
      eval_count?: number;
    };

    return {
      content: data.message?.content || '',
      model: data.model,
      usage: {
        inputTokens: data.prompt_eval_count || 0,
        outputTokens: data.eval_count || 0,
      },
    };
  }
}

// ============================================================================
// AI ROUTER - Multi-model orchestration
// ============================================================================

export interface ModelRouting {
  [skill: string]: string;
}

export class AIRouter {
  private providers: Map<string, AIProvider> = new Map();
  private routing: ModelRouting = {};
  private fallbacks: string[] = [];

  constructor() {
    // Register default providers
    this.registerProvider('claude', new ClaudeProvider());
    this.registerProvider('openai', new OpenAIProvider());
    this.registerProvider('ollama', new OllamaProvider());
  }

  registerProvider(name: string, provider: AIProvider): void {
    this.providers.set(name, provider);
  }

  setRouting(routing: ModelRouting): void {
    this.routing = routing;
  }

  setFallbacks(fallbacks: string[]): void {
    this.fallbacks = fallbacks;
  }

  /**
   * Get the appropriate model for a skill
   */
  getModelForSkill(skill: string): string {
    return this.routing[skill] || this.routing['default'] || 'claude-sonnet-4-20250514';
  }

  /**
   * Get provider from model name
   */
  private getProviderForModel(model: string): AIProvider | null {
    if (model.startsWith('claude') || model.startsWith('anthropic')) {
      return this.providers.get('claude') || null;
    }
    if (model.startsWith('gpt') || model.startsWith('o1')) {
      return this.providers.get('openai') || null;
    }
    if (model.startsWith('llama') || model.startsWith('mistral') || model.startsWith('codellama')) {
      return this.providers.get('ollama') || null;
    }
    // Default to claude
    return this.providers.get('claude') || null;
  }

  /**
   * Execute chat with automatic routing and fallback
   */
  async chat(
    messages: AIMessage[],
    skill?: string,
    config?: Partial<AIProviderConfig>
  ): Promise<AIResponse> {
    const model = skill ? this.getModelForSkill(skill) : (config?.model || 'claude-sonnet-4-20250514');
    
    // Try primary model
    const primaryProvider = this.getProviderForModel(model);
    if (primaryProvider && await primaryProvider.isAvailable()) {
      try {
        return await primaryProvider.chat(messages, { ...config, model });
      } catch (error) {
        console.warn(`Primary model ${model} failed:`, (error as Error).message);
      }
    }

    // Try fallbacks
    for (const fallbackModel of this.fallbacks) {
      const fallbackProvider = this.getProviderForModel(fallbackModel);
      if (fallbackProvider && await fallbackProvider.isAvailable()) {
        try {
          console.log(`Falling back to ${fallbackModel}...`);
          return await fallbackProvider.chat(messages, { ...config, model: fallbackModel });
        } catch (error) {
          console.warn(`Fallback model ${fallbackModel} failed:`, (error as Error).message);
        }
      }
    }

    throw new Error('No AI providers available. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.');
  }

  /**
   * Check which providers are available
   */
  async getAvailableProviders(): Promise<string[]> {
    const available: string[] = [];
    
    for (const [name, provider] of this.providers) {
      if (await provider.isAvailable()) {
        available.push(name);
      }
    }

    return available;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export async function createAIRouter(omgbuildDir?: string): Promise<AIRouter> {
  const router = new AIRouter();

  // Load routing from config if available
  if (omgbuildDir) {
    const configPath = path.join(omgbuildDir, 'config.yaml');
    if (await fs.pathExists(configPath)) {
      const yaml = await import('js-yaml');
      const content = await fs.readFile(configPath, 'utf-8');
      const config = yaml.load(content) as Record<string, unknown>;
      
      const aiConfig = config.ai as Record<string, unknown> | undefined;
      if (aiConfig?.routing) {
        router.setRouting(aiConfig.routing as ModelRouting);
      }
      if (aiConfig?.fallbacks) {
        router.setFallbacks(aiConfig.fallbacks as string[]);
      }
    }
  }

  return router;
}
