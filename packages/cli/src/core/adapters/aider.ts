/**
 * 🔮 OMGBUILD - Aider Adapter
 * Integration with Aider AI pair programming tool
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
// AIDER ADAPTER
// ============================================================================

export class AiderAdapter extends BaseToolAdapter {
  private process: ChildProcess | null = null;

  constructor(config?: Partial<ToolConfig>) {
    super({
      name: 'aider',
      type: 'aider',
      command: 'aider',
      args: [],
      timeout: 600000, // 10 minutes - aider can be slow
      capabilities: DEFAULT_CAPABILITIES['aider'],
      routing: {
        preferFor: ['code', 'refactor'],
        priority: 70,
      },
      ...config,
    });
  }

  /**
   * Check if Aider is available
   */
  async checkAvailability(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('aider', ['--version'], {
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
   * Get Aider version
   */
  async getVersion(): Promise<string | null> {
    return new Promise((resolve) => {
      const proc = spawn('aider', ['--version'], {
        shell: true,
        stdio: 'pipe',
      });

      let output = '';
      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', () => {
        const match = output.match(/aider\s+([\d.]+)/i);
        resolve(match ? match[1] : null);
      });

      proc.on('error', () => {
        resolve(null);
      });
    });
  }

  /**
   * Build command for Aider
   */
  buildCommand(context: ExecutionContext): { command: string; args: string[] } {
    const args: string[] = [];

    // Yes to all prompts (non-interactive)
    args.push('--yes');

    // Don't open browser
    args.push('--no-browser');

    // Add files to context
    if (context.files && context.files.length > 0) {
      for (const file of context.files) {
        args.push('--file', file);
      }
    }

    // Message mode
    args.push('--message', this.formatTask(context));

    return {
      command: this.config.command,
      args,
    };
  }

  /**
   * Format task for Aider
   */
  formatTask(context: ExecutionContext): string {
    return context.task;
  }

  /**
   * Execute with Aider
   */
  async execute(context: ExecutionContext, callbacks?: StreamCallbacks): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    if (!this.available) {
      await this.checkAvailability();
      if (!this.available) {
        return this.createResult(false, '', Date.now() - startTime, {
          error: 'Aider is not available. Install with: pip install aider-chat',
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
   * Parse Aider output
   */
  parseOutput(output: string, context: ExecutionContext): ExecutionResult {
    const artifacts: ExecutionResult['artifacts'] = {
      files: [],
      code: [],
    };

    // Aider shows files it modified
    const fileMatches = output.match(/(?:Applied edit to|Created|Modified)\s+([^\n]+)/gi);
    if (fileMatches) {
      artifacts.files = fileMatches.map(m => {
        const match = m.match(/\s+([^\s]+)$/);
        return match ? match[1] : '';
      }).filter(Boolean);
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
// GENERIC CLI ADAPTER
// ============================================================================

export class GenericCLIAdapter extends BaseToolAdapter {
  private process: ChildProcess | null = null;

  constructor(
    name: string,
    command: string,
    config?: Partial<ToolConfig>
  ) {
    super({
      name,
      type: 'generic',
      command,
      args: [],
      timeout: 300000,
      capabilities: DEFAULT_CAPABILITIES['generic'],
      ...config,
    });
  }

  /**
   * Check availability by running command with --version or --help
   */
  async checkAvailability(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn(this.config.command, ['--version'], {
        shell: true,
        stdio: 'pipe',
      });

      proc.on('close', (code) => {
        // Also try --help if --version fails
        if (code !== 0) {
          const proc2 = spawn(this.config.command, ['--help'], {
            shell: true,
            stdio: 'pipe',
          });
          proc2.on('close', (code2) => {
            this.available = code2 === 0;
            resolve(code2 === 0);
          });
          proc2.on('error', () => {
            this.available = false;
            resolve(false);
          });
        } else {
          this.available = true;
          resolve(true);
        }
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
   * Get version
   */
  async getVersion(): Promise<string | null> {
    return new Promise((resolve) => {
      const proc = spawn(this.config.command, ['--version'], {
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
   * Build command - generic implementation
   */
  buildCommand(context: ExecutionContext): { command: string; args: string[] } {
    const args = [...(this.config.args || [])];
    
    // Add the task as the last argument
    args.push(context.task);

    return {
      command: this.config.command,
      args,
    };
  }

  /**
   * Execute generic command
   */
  async execute(context: ExecutionContext, callbacks?: StreamCallbacks): Promise<ExecutionResult> {
    const startTime = Date.now();
    const { command, args } = this.buildCommand(context);

    return new Promise((resolve) => {
      callbacks?.onStart?.();

      this.process = spawn(command, args, {
        shell: true,
        cwd: context.projectRoot || context.omgbuildDir,
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
   * Parse output - generic implementation
   */
  parseOutput(output: string, context: ExecutionContext): ExecutionResult {
    return this.createResult(true, output, 0, {
      artifacts: {
        files: [],
        code: [],
      },
    });
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
// FACTORIES
// ============================================================================

export function createAiderAdapter(config?: Partial<ToolConfig>): AiderAdapter {
  return new AiderAdapter(config);
}

export function createGenericAdapter(
  name: string,
  command: string,
  config?: Partial<ToolConfig>
): GenericCLIAdapter {
  return new GenericCLIAdapter(name, command, config);
}
