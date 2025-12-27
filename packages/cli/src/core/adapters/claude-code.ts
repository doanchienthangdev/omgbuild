/**
 * 🔮 OMGBUILD - Claude Code Adapter
 * Integration with Anthropic's Claude Code CLI
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
// CLAUDE CODE ADAPTER
// ============================================================================

export class ClaudeCodeAdapter extends BaseToolAdapter {
  private process: ChildProcess | null = null;

  constructor(config?: Partial<ToolConfig>) {
    super({
      name: 'claude-code',
      type: 'claude-code',
      command: 'claude',
      args: [],
      timeout: 300000, // 5 minutes
      capabilities: DEFAULT_CAPABILITIES['claude-code'],
      routing: {
        preferFor: ['code', 'refactor', 'debug', 'analyze'],
        priority: 90, // High priority - very capable
      },
      ...config,
    });
  }

  /**
   * Check if Claude Code CLI is installed and available
   */
  async checkAvailability(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('claude', ['--version'], {
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

      // Timeout after 5 seconds
      setTimeout(() => {
        proc.kill();
        resolve(false);
      }, 5000);
    });
  }

  /**
   * Get Claude Code version
   */
  async getVersion(): Promise<string | null> {
    return new Promise((resolve) => {
      const proc = spawn('claude', ['--version'], {
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
   * Build command for Claude Code
   */
  buildCommand(context: ExecutionContext): { command: string; args: string[] } {
    const args: string[] = [];

    // Use print mode for non-interactive execution
    args.push('--print');

    // Add project directory
    if (context.projectRoot) {
      args.push('--cwd', context.projectRoot);
    }

    // Add the task/prompt
    args.push(this.formatTask(context));

    return {
      command: this.config.command,
      args,
    };
  }

  /**
   * Format task for Claude Code
   */
  formatTask(context: ExecutionContext): string {
    let prompt = context.task;

    // Add OMGBUILD context
    const omgContext: string[] = [];

    // Reference skill if applicable
    if (context.taskType && context.taskType !== 'custom') {
      omgContext.push(`[OMGBUILD Skill: ${context.taskType}]`);
    }

    // Add file context
    if (context.files && context.files.length > 0) {
      omgContext.push(`Files: ${context.files.join(', ')}`);
    }

    // Add memory context
    if (context.memory?.decisions.length) {
      omgContext.push(`Recent decisions: ${context.memory.decisions.length} recorded`);
    }

    if (omgContext.length > 0) {
      prompt = `${omgContext.join(' | ')}\n\n${prompt}`;
    }

    return prompt;
  }

  /**
   * Execute task with Claude Code
   */
  async execute(context: ExecutionContext, callbacks?: StreamCallbacks): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    if (!this.available) {
      await this.checkAvailability();
      if (!this.available) {
        return this.createResult(false, '', Date.now() - startTime, {
          error: 'Claude Code CLI is not available. Install with: npm install -g @anthropic-ai/claude-code',
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
        this.emit('error', chunk);
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
        this.emit('complete', result);
        resolve(result);
      });

      this.process.on('error', (error) => {
        const duration = Date.now() - startTime;
        const result = this.createResult(false, stdout, duration, {
          error: error.message,
        });
        
        callbacks?.onComplete?.(result);
        resolve(result);
      });

      // Handle timeout
      if (this.config.timeout) {
        setTimeout(() => {
          if (this.process) {
            this.process.kill();
            const result = this.createResult(false, stdout, this.config.timeout!, {
              error: 'Execution timed out',
            });
            resolve(result);
          }
        }, this.config.timeout);
      }
    });
  }

  /**
   * Parse Claude Code output
   */
  parseOutput(output: string, context: ExecutionContext): ExecutionResult {
    const artifacts: ExecutionResult['artifacts'] = {
      files: [],
      code: [],
    };

    // Extract file paths mentioned in output
    const fileMatches = output.match(/(?:created|modified|wrote|saved):\s*([^\s\n]+)/gi);
    if (fileMatches) {
      artifacts.files = fileMatches.map(m => {
        const match = m.match(/:\s*([^\s\n]+)/);
        return match ? match[1] : '';
      }).filter(Boolean);
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
   * Stop current execution
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

export function createClaudeCodeAdapter(config?: Partial<ToolConfig>): ClaudeCodeAdapter {
  return new ClaudeCodeAdapter(config);
}
