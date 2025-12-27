/**
 * 🔮 OMGBUILD - Codex Adapter
 * Integration with OpenAI Codex CLI
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
// CODEX ADAPTER
// ============================================================================

export class CodexAdapter extends BaseToolAdapter {
  private process: ChildProcess | null = null;

  constructor(config?: Partial<ToolConfig>) {
    super({
      name: 'codex',
      type: 'codex',
      command: 'codex',  // OpenAI Codex CLI
      args: [],
      timeout: 300000,
      capabilities: DEFAULT_CAPABILITIES['codex'],
      routing: {
        preferFor: ['code', 'test'],
        priority: 80,
      },
      ...config,
    });
  }

  /**
   * Check if Codex CLI is available
   */
  async checkAvailability(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('codex', ['--version'], {
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
   * Get Codex version
   */
  async getVersion(): Promise<string | null> {
    return new Promise((resolve) => {
      const proc = spawn('codex', ['--version'], {
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
   * Build command for Codex
   */
  buildCommand(context: ExecutionContext): { command: string; args: string[] } {
    const args: string[] = [];

    // Quiet mode for non-interactive
    args.push('--quiet');

    // Full auto-approve for automation
    args.push('--full-auto');

    // Add the prompt
    args.push(this.formatTask(context));

    return {
      command: this.config.command,
      args,
    };
  }

  /**
   * Format task for Codex
   */
  formatTask(context: ExecutionContext): string {
    let prompt = context.task;

    // Add project context
    if (context.files && context.files.length > 0) {
      prompt += `\n\nContext files:\n${context.files.map(f => `- ${f}`).join('\n')}`;
    }

    return prompt;
  }

  /**
   * Execute with Codex
   */
  async execute(context: ExecutionContext, callbacks?: StreamCallbacks): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    if (!this.available) {
      await this.checkAvailability();
      if (!this.available) {
        return this.createResult(false, '', Date.now() - startTime, {
          error: 'Codex CLI is not available. Install with: npm install -g @openai/codex',
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
   * Parse Codex output
   */
  parseOutput(output: string, context: ExecutionContext): ExecutionResult {
    const artifacts: ExecutionResult['artifacts'] = {
      files: [],
      code: [],
    };

    // Extract created/modified files
    const fileMatches = output.match(/(?:Created|Modified|Wrote):\s*([^\n]+)/gi);
    if (fileMatches) {
      artifacts.files = fileMatches.map(m => m.split(/:\s*/)[1]?.trim()).filter(Boolean);
    }

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

export function createCodexAdapter(config?: Partial<ToolConfig>): CodexAdapter {
  return new CodexAdapter(config);
}
