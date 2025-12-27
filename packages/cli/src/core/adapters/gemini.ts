/**
 * 🔮 OMGBUILD - Gemini Adapter
 * Integration with Google Gemini CLI
 */

import { spawn, ChildProcess } from 'child_process';
import { 
  BaseToolAdapter, 
  ToolConfig, 
  ExecutionContext, 
  ExecutionResult, 
  StreamCallbacks,
  DEFAULT_CAPABILITIES 
} from './base-adapter';

// ============================================================================
// GEMINI ADAPTER
// ============================================================================

export class GeminiAdapter extends BaseToolAdapter {
  private process: ChildProcess | null = null;

  constructor(config?: Partial<ToolConfig>) {
    super({
      name: 'gemini',
      type: 'gemini',
      command: 'gemini',  // Google Gemini CLI
      args: [],
      timeout: 300000,
      capabilities: DEFAULT_CAPABILITIES['gemini'],
      routing: {
        preferFor: ['analyze', 'explain', 'document'],
        priority: 75,
      },
      ...config,
    });
  }

  /**
   * Check if Gemini CLI is available
   */
  async checkAvailability(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('gemini', ['--version'], {
        shell: true,
        stdio: 'pipe',
      });

      proc.on('close', (code) => {
        this.available = code === 0;
        resolve(code === 0);
      });

      proc.on('error', () => {
        this.available = false;
        resolve(false);
      });

      setTimeout(() => {
        proc.kill();
        resolve(false);
      }, 5000);
    });
  }

  /**
   * Get Gemini version
   */
  async getVersion(): Promise<string | null> {
    return new Promise((resolve) => {
      const proc = spawn('gemini', ['--version'], {
        shell: true,
        stdio: 'pipe',
      });

      let output = '';
      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', () => {
        const match = output.match(/[\d.]+/);
        resolve(match ? match[0] : null);
      });

      proc.on('error', () => {
        resolve(null);
      });
    });
  }

  /**
   * Build command for Gemini
   */
  buildCommand(context: ExecutionContext): { command: string; args: string[] } {
    const args: string[] = [];

    // Non-interactive mode
    args.push('--non-interactive');

    // Sandbox mode for safety
    if (context.taskType === 'shell' || context.taskType === 'code') {
      args.push('--sandbox');
    }

    // Add the prompt
    args.push('-p', this.formatTask(context));

    return {
      command: this.config.command,
      args,
    };
  }

  /**
   * Format task for Gemini
   */
  formatTask(context: ExecutionContext): string {
    let prompt = context.task;

    // Add structured context
    const contextParts: string[] = [];

    if (context.taskType) {
      contextParts.push(`Task type: ${context.taskType}`);
    }

    if (context.files && context.files.length > 0) {
      contextParts.push(`Files: ${context.files.join(', ')}`);
    }

    if (contextParts.length > 0) {
      prompt = `[${contextParts.join(' | ')}]\n\n${prompt}`;
    }

    return prompt;
  }

  /**
   * Execute with Gemini
   */
  async execute(context: ExecutionContext, callbacks?: StreamCallbacks): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    if (!this.available) {
      await this.checkAvailability();
      if (!this.available) {
        return this.createResult(false, '', Date.now() - startTime, {
          error: 'Gemini CLI is not available. Install from Google Cloud SDK.',
        });
      }
    }

    const { command, args } = this.buildCommand(context);

    return new Promise((resolve) => {
      callbacks?.onStart?.();

      this.process = spawn(command, args, {
        shell: true,
        cwd: context.projectRoot,
        env: {
          ...process.env,
          ...this.config.env,
        },
      });

      let stdout = '';
      let stderr = '';

      this.process.stdout?.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        callbacks?.onOutput?.(chunk);
        this.emit('output', chunk);
      });

      this.process.stderr?.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        callbacks?.onError?.(chunk);
      });

      this.process.on('close', (code) => {
        const duration = Date.now() - startTime;
        const result = this.parseOutput(stdout, context);
        
        result.duration = duration;
        result.success = code === 0;
        if (stderr && code !== 0) {
          result.error = stderr;
        }

        callbacks?.onComplete?.(result);
        resolve(result);
      });

      this.process.on('error', (error) => {
        const duration = Date.now() - startTime;
        resolve(this.createResult(false, stdout, duration, {
          error: error.message,
        }));
      });

      if (this.config.timeout) {
        setTimeout(() => {
          if (this.process) {
            this.process.kill();
            resolve(this.createResult(false, stdout, this.config.timeout!, {
              error: 'Execution timed out',
            }));
          }
        }, this.config.timeout);
      }
    });
  }

  /**
   * Parse Gemini output
   */
  parseOutput(output: string, context: ExecutionContext): ExecutionResult {
    const artifacts: ExecutionResult['artifacts'] = {
      files: [],
      code: [],
    };

    // Extract code blocks
    const codeBlocks = output.match(/```[\s\S]*?```/g);
    if (codeBlocks) {
      artifacts.code = codeBlocks.map(block => 
        block.replace(/```\w*\n?/g, '').trim()
      );
    }

    return this.createResult(true, output, 0, { artifacts });
  }

  /**
   * Stop execution
   */
  stop(): void {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createGeminiAdapter(config?: Partial<ToolConfig>): GeminiAdapter {
  return new GeminiAdapter(config);
}
