/**
 * 🔮 OMGBUILD Run Command
 * Execute skills and workflows with AI agents
 */

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { createSkillExecutor } from '../core/skill-executor';
import { createWorkflowEngine, WorkflowStage, WorkflowContext } from '../core/workflow-engine';
import { createInterface } from 'readline';

// ============================================================================
// HELPERS
// ============================================================================

function createReadline() {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

async function prompt(question: string): Promise<string> {
  const rl = createReadline();
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// ============================================================================
// RUN COMMAND
// ============================================================================

export const runCommand = new Command('run')
  .description('Execute skills and workflows with AI agents')
  .argument('<type>', 'What to run: skill or workflow')
  .argument('<name>', 'Name of the skill or workflow')
  .argument('[task]', 'Task description')
  .option('-i, --interactive', 'Interactive mode with prompts')
  .option('-o, --output <dir>', 'Custom output directory')
  .option('--no-save', 'Don\'t save artifacts')
  .option('--model <model>', 'Override AI model')
  .option('--verbose', 'Show detailed output')
  .action(async (
    type: string,
    name: string,
    task: string | undefined,
    options: {
      interactive?: boolean;
      output?: string;
      save?: boolean;
      model?: string;
      verbose?: boolean;
    }
  ) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    if (!await fs.pathExists(omgbuildDir)) {
      console.error('❌ No .omgbuild directory found. Run `omgbuild init` first.');
      process.exit(1);
    }

    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
      console.error(`
❌ No AI API key found.

Please set one of these environment variables:
  export ANTHROPIC_API_KEY=your-key
  export OPENAI_API_KEY=your-key

Get your API key from:
  - Claude: https://console.anthropic.com/
  - OpenAI: https://platform.openai.com/
`);
      process.exit(1);
    }

    try {
      if (type === 'skill') {
        await runSkill(omgbuildDir, name, task, options);
      } else if (type === 'workflow') {
        await runWorkflow(omgbuildDir, name, task, options);
      } else {
        console.error(`❌ Unknown type: ${type}. Use 'skill' or 'workflow'.`);
        process.exit(1);
      }
    } catch (error) {
      console.error(`\n❌ Error: ${(error as Error).message}`);
      if (options.verbose) {
        console.error((error as Error).stack);
      }
      process.exit(1);
    }
  });

// ============================================================================
// RUN SKILL
// ============================================================================

async function runSkill(
  omgbuildDir: string,
  skillName: string,
  task: string | undefined,
  options: {
    interactive?: boolean;
    output?: string;
    save?: boolean;
    model?: string;
    verbose?: boolean;
  }
) {
  console.log(`
🔮 ╔═══════════════════════════════════════════════════════════════╗
   ║  RUNNING SKILL: ${skillName.toUpperCase().padEnd(44)}║
   ╚═══════════════════════════════════════════════════════════════╝
`);

  const executor = await createSkillExecutor(omgbuildDir);
  const availableSkills = executor.getSkills();

  if (!availableSkills.includes(skillName)) {
    console.error(`❌ Skill not found: ${skillName}`);
    console.log(`\nAvailable skills: ${availableSkills.join(', ')}`);
    process.exit(1);
  }

  // Get task if not provided
  let taskDescription = task;
  if (!taskDescription) {
    if (options.interactive) {
      taskDescription = await prompt('📝 Describe your task: ');
    } else {
      console.error('❌ Task description required. Use: omgbuild run skill <name> "your task"');
      process.exit(1);
    }
  }

  console.log(`   📋 Task: ${taskDescription}`);
  console.log(`   🤖 Executing with AI...`);
  console.log();

  const startTime = Date.now();

  // Execute skill
  const result = await executor.execute(skillName, {
    task: taskDescription,
  });

  const duration = formatDuration(Date.now() - startTime);

  // Display result
  console.log(`${'─'.repeat(60)}`);
  console.log(`\n📤 OUTPUT:\n`);
  console.log(result.content);
  console.log(`\n${'─'.repeat(60)}`);

  // Save artifacts
  if (options.save !== false && result.artifacts.length > 0) {
    const outputDir = options.output || path.join(omgbuildDir, 'generated', 'skills', skillName, `${Date.now()}`);
    const savedPaths = await executor.saveArtifacts(result.artifacts, outputDir);
    
    console.log(`\n📁 Artifacts saved:`);
    savedPaths.forEach(p => console.log(`   • ${p}`));
  }

  // Display metadata
  console.log(`
📊 Execution Summary:
   • Skill: ${result.metadata.skill}
   • Model: ${result.metadata.model}
   • Duration: ${duration}
   • Tokens: ${result.metadata.tokens.input} in / ${result.metadata.tokens.output} out
   • Artifacts: ${result.artifacts.length}
`);
}

// ============================================================================
// RUN WORKFLOW
// ============================================================================

async function runWorkflow(
  omgbuildDir: string,
  workflowName: string,
  description: string | undefined,
  options: {
    interactive?: boolean;
    output?: string;
    save?: boolean;
    model?: string;
    verbose?: boolean;
  }
) {
  console.log(`
🔮 ╔═══════════════════════════════════════════════════════════════╗
   ║  RUNNING WORKFLOW: ${workflowName.toUpperCase().padEnd(41)}║
   ╚═══════════════════════════════════════════════════════════════╝
`);

  const engine = await createWorkflowEngine(omgbuildDir);
  const availableWorkflows = engine.getWorkflows();

  if (!availableWorkflows.includes(workflowName)) {
    console.error(`❌ Workflow not found: ${workflowName}`);
    console.log(`\nAvailable workflows: ${availableWorkflows.join(', ')}`);
    process.exit(1);
  }

  // Get description if not provided
  let workflowDescription = description;
  if (!workflowDescription) {
    if (options.interactive) {
      workflowDescription = await prompt('📝 Describe what you want to build: ');
    } else {
      console.error('❌ Description required. Use: omgbuild run workflow <name> "description"');
      process.exit(1);
    }
  }

  const workflow = engine.getWorkflow(workflowName);
  console.log(`   📋 ${workflow?.description || ''}`);
  console.log(`   📝 Task: ${workflowDescription}`);
  console.log();

  // Progress tracking
  let currentStageIndex = 0;
  const totalStages = workflow?.stages.length || 0;

  // Execute workflow
  const result = await engine.execute(workflowName, workflowDescription, {
    interactive: options.interactive,

    onStageStart: (stage, status) => {
      currentStageIndex++;
      const progress = `[${currentStageIndex}/${totalStages}]`;
      console.log(`\n${progress} 🚀 ${stage.name}...`);
    },

    onStageComplete: (stage, status, stageResult) => {
      if (status === 'completed') {
        console.log(`   ✅ Completed`);
        if (options.verbose && stageResult?.output) {
          console.log(`   📊 ${stageResult.output.metadata.model} - ${formatDuration(stageResult.output.metadata.duration)}`);
        }
      } else if (status === 'failed') {
        console.log(`   ❌ Failed: ${stageResult?.error}`);
      } else if (status === 'skipped') {
        console.log(`   ⏭️ Skipped: ${stageResult?.skipReason}`);
      }
    },

    onGate: async (stage: WorkflowStage, context: WorkflowContext) => {
      if (!options.interactive) {
        return { proceed: true };
      }

      console.log(`\n⚠️  GATE: ${stage.gate?.message || 'Review required'}`);
      
      if (stage.gate?.type === 'human_review') {
        const answer = await prompt('   Proceed? (y/n/input): ');
        
        if (answer.toLowerCase() === 'n') {
          return { proceed: false };
        }
        if (answer.toLowerCase() !== 'y') {
          return { proceed: true, input: answer };
        }
      }

      return { proceed: true };
    },
  });

  // Display summary
  console.log(`
${'═'.repeat(60)}
📊 WORKFLOW COMPLETE
${'═'.repeat(60)}

   Status: ${result.success ? '✅ Success' : '❌ Failed'}
   Duration: ${formatDuration(result.duration)}
   Stages: ${result.stageResults.filter(r => r.success).length}/${result.stageResults.length} completed

`);

  if (result.artifacts.length > 0) {
    console.log(`📁 Artifacts (${result.artifacts.length}):`);
    result.artifacts.slice(0, 10).forEach(a => {
      console.log(`   • ${path.relative(process.cwd(), a)}`);
    });
    if (result.artifacts.length > 10) {
      console.log(`   ... and ${result.artifacts.length - 10} more`);
    }
    console.log();
  }

  console.log(`📂 Full output: ${path.relative(process.cwd(), result.context.artifactsDir)}`);
  console.log();

  if (!result.success) {
    process.exit(1);
  }
}
