/**
 * 🔮 OMGBUILD Exec Command
 * Direct execution of AI tools
 */

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import {
  createDefaultRegistry,
  createAdapter,
  ToolType,
  ExecutionContext,
  TaskType,
} from '../core/adapters';

// ============================================================================
// EXEC COMMAND
// ============================================================================

export const execCommand = new Command('exec')
  .description('Execute AI tools directly')
  .argument('<task>', 'Task to execute')
  .option('-t, --tool <tool>', 'Specific tool to use (claude-code, codex, gemini, aider)')
  .option('--type <type>', 'Task type (code, analyze, test, review, refactor, debug, document)')
  .option('-f, --files <files...>', 'Files to include in context')
  .option('--skill <skill>', 'OMGBUILD skill to apply')
  .option('-v, --verbose', 'Verbose output')
  .option('--timeout <ms>', 'Timeout in milliseconds', '300000')
  .option('--dry-run', 'Show what would be executed')
  .action(async (
    task: string,
    options: {
      tool?: string;
      type?: string;
      files?: string[];
      skill?: string;
      verbose?: boolean;
      timeout?: string;
      dryRun?: boolean;
    }
  ) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    const projectRoot = process.cwd();

    console.log(`
🔮 OMGBUILD Direct Execution
${'═'.repeat(50)}

Task: ${task.slice(0, 100)}${task.length > 100 ? '...' : ''}
Tool: ${options.tool || 'auto-select'}
Type: ${options.type || 'auto-detect'}
`);

    if (options.dryRun) {
      console.log('📋 Dry Run Mode\n');
      console.log(`Would execute with:`);
      console.log(`  Tool: ${options.tool || 'best available'}`);
      console.log(`  Type: ${options.type || 'auto-detected'}`);
      console.log(`  Files: ${options.files?.join(', ') || 'none'}`);
      console.log(`  Skill: ${options.skill || 'none'}`);
      return;
    }

    // Initialize registry
    console.log('🔧 Discovering tools...\n');
    const registry = await createDefaultRegistry();
    const available = await registry.getAvailable();

    if (available.length === 0) {
      console.error('❌ No AI tools available!');
      console.log(`
Install at least one:
  - Claude Code: npm install -g @anthropic-ai/claude-code
  - Codex:       npm install -g @openai/codex
  - Aider:       pip install aider-chat
  - Gemini:      Install Google Cloud SDK
`);
      process.exit(1);
    }

    console.log(`Available: ${available.map(t => t.name).join(', ')}\n`);

    // Select tool
    let tool;
    if (options.tool) {
      tool = registry.get(options.tool);
      if (!tool) {
        console.error(`❌ Tool not found: ${options.tool}`);
        console.log(`Available: ${available.map(t => t.name).join(', ')}`);
        process.exit(1);
      }
      if (!await tool.checkAvailability()) {
        console.error(`❌ Tool not available: ${options.tool}`);
        process.exit(1);
      }
    } else {
      // Auto-select based on task type
      const taskType = (options.type as TaskType) || inferTaskType(task);
      tool = await registry.findBestTool(taskType);
      if (!tool) {
        console.error(`❌ No suitable tool found for task type: ${taskType}`);
        process.exit(1);
      }
    }

    console.log(`🔧 Using: ${tool.name}\n`);

    // Build context
    const context: ExecutionContext = {
      task,
      taskType: (options.type as TaskType) || inferTaskType(task),
      projectRoot,
      omgbuildDir,
      files: options.files,
      metadata: {
        skill: options.skill,
      },
    };

    // Load memory if available
    if (await fs.pathExists(omgbuildDir)) {
      try {
        const memoryDir = path.join(omgbuildDir, 'memory');
        if (await fs.pathExists(memoryDir)) {
          // Load recent decisions
          const decisionsDir = path.join(memoryDir, 'decisions');
          if (await fs.pathExists(decisionsDir)) {
            const files = await fs.readdir(decisionsDir);
            const decisions = [];
            for (const file of files.slice(-5)) {
              const content = await fs.readFile(path.join(decisionsDir, file), 'utf-8');
              decisions.push(content);
            }
            context.memory = {
              decisions,
              patterns: [],
              learnings: [],
            };
          }
        }
      } catch {
        // Ignore memory loading errors
      }
    }

    // Execute
    console.log('▶️  Executing...\n');
    console.log('─'.repeat(50));

    const startTime = Date.now();

    try {
      const result = await tool.execute(context, {
        onStart: () => {
          if (options.verbose) {
            console.log('[Started]');
          }
        },
        onOutput: (chunk) => {
          process.stdout.write(chunk);
        },
        onError: (error) => {
          if (options.verbose) {
            console.error(`[Error] ${error}`);
          }
        },
      });

      console.log('\n' + '─'.repeat(50));

      if (result.success) {
        console.log(`\n✅ Completed in ${formatDuration(result.duration)}`);
        
        if (result.artifacts?.files.length) {
          console.log(`\n📁 Files affected:`);
          result.artifacts.files.forEach(f => console.log(`   - ${f}`));
        }

        if (result.tokensUsed) {
          console.log(`\n📊 Tokens used: ${result.tokensUsed.toLocaleString()}`);
        }
      } else {
        console.log(`\n❌ Failed: ${result.error}`);
        process.exit(1);
      }
    } catch (error) {
      console.log('\n' + '─'.repeat(50));
      console.error(`\n❌ Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// ============================================================================
// HELPERS
// ============================================================================

function inferTaskType(task: string): TaskType {
  const taskLower = task.toLowerCase();

  if (taskLower.includes('analyze') || taskLower.includes('review') || taskLower.includes('assess')) {
    return 'analyze';
  }
  if (taskLower.includes('test') || taskLower.includes('spec') || taskLower.includes('coverage')) {
    return 'test';
  }
  if (taskLower.includes('refactor') || taskLower.includes('cleanup') || taskLower.includes('reorganize')) {
    return 'refactor';
  }
  if (taskLower.includes('debug') || taskLower.includes('fix') || taskLower.includes('bug')) {
    return 'debug';
  }
  if (taskLower.includes('document') || taskLower.includes('readme') || taskLower.includes('docs')) {
    return 'document';
  }
  if (taskLower.includes('explain') || taskLower.includes('what is') || taskLower.includes('how does')) {
    return 'explain';
  }

  return 'code';
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}
