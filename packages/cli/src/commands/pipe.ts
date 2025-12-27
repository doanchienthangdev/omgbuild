/**
 * 🔮 OMGBUILD Pipe Command
 * Pipeline management and execution
 */

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import readline from 'readline';
import {
  PipelineParser,
  PipelineRunner,
  Pipeline,
  PipelineStep,
  StepResult,
  createPipelineRunner,
} from '../core/pipeline';
import { 
  getBuiltinPipeline, 
  listBuiltinPipelines,
  BUILTIN_PIPELINES,
} from '../core/pipeline/builtin-pipelines';
import { createDefaultRegistry } from '../core/adapters';

// ============================================================================
// PIPE COMMAND
// ============================================================================

export const pipeCommand = new Command('pipe')
  .description('Run and manage development pipelines')
  .action(() => {
    console.log(`
🔮 OMGBUILD Pipeline Engine

Commands:
  omgbuild pipe run <name> [vars...]      Run a pipeline
  omgbuild pipe list                      List available pipelines
  omgbuild pipe show <name>               Show pipeline details
  omgbuild pipe create <name>             Create a custom pipeline
  omgbuild pipe validate <file>           Validate a pipeline file

Built-in Pipelines:
  feature    Complete feature development (analyze → code → test → review)
  bugfix     Bug investigation and fix
  review     Comprehensive code review
  refactor   Safe code refactoring
  testing    Test generation pipeline
  docs       Documentation generation
  release    Release preparation

Examples:
  omgbuild pipe run feature FEATURE_DESCRIPTION="Add auth"
  omgbuild pipe run bugfix BUG_DESCRIPTION="Login fails"
  omgbuild pipe run review FILES="src/**/*.ts"
  omgbuild pipe run ./custom-pipeline.yaml
`);
  });

// ============================================================================
// RUN COMMAND
// ============================================================================

pipeCommand
  .command('run <name> [vars...]')
  .description('Run a pipeline')
  .option('-i, --interactive', 'Interactive mode with gates')
  .option('-v, --verbose', 'Verbose output')
  .option('--dry-run', 'Show what would be executed without running')
  .option('--step <step>', 'Run only a specific step')
  .option('--from <step>', 'Start from a specific step')
  .option('--to <step>', 'Stop at a specific step')
  .action(async (
    name: string,
    vars: string[],
    options: {
      interactive?: boolean;
      verbose?: boolean;
      dryRun?: boolean;
      step?: string;
      from?: string;
      to?: string;
    }
  ) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');

    // Parse variables
    const variables: Record<string, string> = {};
    for (const v of vars) {
      const [key, ...valueParts] = v.split('=');
      variables[key] = valueParts.join('=');
    }

    // Load pipeline
    let pipeline: Pipeline;

    // Check if it's a file path
    if (name.endsWith('.yaml') || name.endsWith('.yml')) {
      if (!await fs.pathExists(name)) {
        console.error(`❌ Pipeline file not found: ${name}`);
        process.exit(1);
      }
      pipeline = await PipelineParser.fromFile(name);
    } else {
      // Check built-in pipelines
      const builtin = getBuiltinPipeline(name);
      if (builtin) {
        pipeline = builtin;
      } else {
        // Check custom pipelines
        const customPath = path.join(omgbuildDir, 'pipelines', `${name}.yaml`);
        if (await fs.pathExists(customPath)) {
          pipeline = await PipelineParser.fromFile(customPath);
        } else {
          console.error(`❌ Pipeline not found: ${name}`);
          console.log(`\nAvailable pipelines:`);
          listBuiltinPipelines().forEach(p => console.log(`  - ${p.name}: ${p.description}`));
          process.exit(1);
        }
      }
    }

    console.log(`
🔮 OMGBUILD Pipeline: ${pipeline.name}
${'═'.repeat(60)}
${pipeline.description || ''}

Steps: ${pipeline.steps.length}
Variables: ${Object.keys(variables).join(', ') || 'none'}
Mode: ${options.interactive ? 'Interactive' : 'Automatic'}
`);

    if (options.dryRun) {
      console.log('📋 Dry Run - Steps to execute:\n');
      for (let i = 0; i < pipeline.steps.length; i++) {
        const step = pipeline.steps[i];
        console.log(`${i + 1}. [${step.id}] ${step.name}`);
        if (step.description) console.log(`   ${step.description}`);
        if (step.tool) console.log(`   Tool: ${step.tool}`);
        if (step.skill) console.log(`   Skill: ${step.skill}`);
        if (step.dependsOn?.length) console.log(`   Depends: ${step.dependsOn.join(', ')}`);
        if (step.gate?.enabled) console.log(`   ⏸️  Has gate`);
        console.log();
      }
      return;
    }

    // Create runner
    console.log('🔧 Initializing tool registry...\n');
    const registry = await createDefaultRegistry();
    const availableTools = await registry.getAvailable();
    
    if (availableTools.length === 0) {
      console.error('❌ No AI tools available. Install at least one:');
      console.log('   - Claude Code: npm install -g @anthropic-ai/claude-code');
      console.log('   - Codex: npm install -g @openai/codex');
      console.log('   - Aider: pip install aider-chat');
      process.exit(1);
    }

    console.log(`✅ Available tools: ${availableTools.map(t => t.name).join(', ')}\n`);

    const runner = new PipelineRunner(registry);

    // Run pipeline
    const startTime = Date.now();
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const askQuestion = (question: string): Promise<boolean> => {
      return new Promise((resolve) => {
        rl.question(question + ' (y/n): ', (answer) => {
          resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
      });
    };

    try {
      const result = await runner.run(
        pipeline,
        {
          projectRoot: process.cwd(),
          omgbuildDir,
          variables,
        },
        {
          onStepStart: (step, index) => {
            console.log(`\n${'─'.repeat(60)}`);
            console.log(`▶️  Step ${index + 1}/${pipeline.steps.length}: ${step.name}`);
            if (options.verbose && step.description) {
              console.log(`   ${step.description}`);
            }
          },
          onStepOutput: (stepId, chunk) => {
            if (options.verbose) {
              process.stdout.write(chunk);
            }
          },
          onStepComplete: (stepResult) => {
            if (stepResult.skipped) {
              console.log(`⏭️  Skipped: ${stepResult.skipReason}`);
            } else if (stepResult.success) {
              console.log(`✅ Completed in ${formatDuration(stepResult.duration)}`);
              if (stepResult.artifacts?.files.length) {
                console.log(`   Files: ${stepResult.artifacts.files.join(', ')}`);
              }
            } else {
              console.log(`❌ Failed: ${stepResult.error}`);
            }
          },
          onGate: async (step) => {
            if (!options.interactive) {
              return true;
            }
            console.log(`\n⏸️  Gate: ${step.gate?.message || 'Continue?'}`);
            return await askQuestion('Proceed');
          },
          onPipelineComplete: (result) => {
            console.log(`\n${'═'.repeat(60)}`);
            if (result.success) {
              console.log(`✅ Pipeline completed successfully!`);
            } else {
              console.log(`❌ Pipeline failed: ${result.error}`);
            }
            console.log(`⏱️  Total time: ${formatDuration(result.totalDuration)}`);
            
            if (result.artifacts.files.length > 0) {
              console.log(`\n📁 Generated files:`);
              result.artifacts.files.forEach(f => console.log(`   - ${f}`));
            }
          },
        }
      );

      rl.close();

      if (!result.success) {
        process.exit(1);
      }
    } catch (error) {
      rl.close();
      console.error(`\n❌ Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// ============================================================================
// LIST COMMAND
// ============================================================================

pipeCommand
  .command('list')
  .alias('ls')
  .description('List available pipelines')
  .option('-a, --all', 'Show all details')
  .action(async (options: { all?: boolean }) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');

    console.log(`
🔮 Available Pipelines
${'═'.repeat(60)}

📦 Built-in Pipelines:
`);

    const builtins = listBuiltinPipelines();
    for (const p of builtins) {
      console.log(`   ${p.name.padEnd(12)} ${p.steps} steps  ${p.description}`);
    }

    // Check for custom pipelines
    const customDir = path.join(omgbuildDir, 'pipelines');
    if (await fs.pathExists(customDir)) {
      const files = await fs.readdir(customDir);
      const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

      if (yamlFiles.length > 0) {
        console.log(`\n📁 Custom Pipelines:`);
        for (const file of yamlFiles) {
          try {
            const pipeline = await PipelineParser.fromFile(path.join(customDir, file));
            console.log(`   ${pipeline.name.padEnd(12)} ${pipeline.steps.length} steps  ${pipeline.description || ''}`);
          } catch {
            console.log(`   ${file.padEnd(12)} (invalid)`);
          }
        }
      }
    }

    console.log(`
Usage:
   omgbuild pipe run <name> [VARIABLE=value...]
`);
  });

// ============================================================================
// SHOW COMMAND
// ============================================================================

pipeCommand
  .command('show <name>')
  .description('Show pipeline details')
  .action(async (name: string) => {
    let pipeline: Pipeline | undefined;

    // Check built-in
    pipeline = getBuiltinPipeline(name);

    // Check custom
    if (!pipeline) {
      const omgbuildDir = path.join(process.cwd(), '.omgbuild');
      const customPath = path.join(omgbuildDir, 'pipelines', `${name}.yaml`);
      if (await fs.pathExists(customPath)) {
        pipeline = await PipelineParser.fromFile(customPath);
      }
    }

    if (!pipeline) {
      console.error(`❌ Pipeline not found: ${name}`);
      process.exit(1);
    }

    console.log(`
🔮 Pipeline: ${pipeline.name}
${'═'.repeat(60)}

${pipeline.description || 'No description'}

Version: ${pipeline.version || '1.0.0'}
Tags:    ${pipeline.tags?.join(', ') || 'none'}

📋 Steps (${pipeline.steps.length}):
`);

    for (let i = 0; i < pipeline.steps.length; i++) {
      const step = pipeline.steps[i];
      console.log(`${(i + 1).toString().padStart(2)}. [${step.id}] ${step.name}`);
      if (step.description) console.log(`    ${step.description}`);
      if (step.skill) console.log(`    Skill: ${step.skill}`);
      if (step.tool) console.log(`    Tool: ${step.tool}`);
      if (step.dependsOn?.length) console.log(`    Depends: ${step.dependsOn.join(', ')}`);
      if (step.gate?.enabled) console.log(`    ⏸️  Gate: ${step.gate.message || 'Requires approval'}`);
      console.log();
    }

    console.log(`
Variables needed:
${extractVariables(pipeline).map(v => `   \${${v}}`).join('\n') || '   (none)'}

Example:
   omgbuild pipe run ${pipeline.name} ${extractVariables(pipeline).map(v => `${v}="..."`).join(' ')}
`);
  });

// ============================================================================
// CREATE COMMAND
// ============================================================================

pipeCommand
  .command('create <name>')
  .description('Create a custom pipeline')
  .option('-t, --template <template>', 'Use built-in as template')
  .action(async (name: string, options: { template?: string }) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    const pipelinesDir = path.join(omgbuildDir, 'pipelines');

    await fs.ensureDir(pipelinesDir);

    const outputPath = path.join(pipelinesDir, `${name}.yaml`);

    if (await fs.pathExists(outputPath)) {
      console.error(`❌ Pipeline already exists: ${outputPath}`);
      process.exit(1);
    }

    let pipeline: Pipeline;

    if (options.template) {
      const template = getBuiltinPipeline(options.template);
      if (!template) {
        console.error(`❌ Template not found: ${options.template}`);
        process.exit(1);
      }
      pipeline = { ...template, name };
    } else {
      pipeline = {
        name,
        description: `Custom pipeline: ${name}`,
        version: '1.0.0',
        tags: ['custom'],
        steps: [
          {
            id: 'step-1',
            name: 'First Step',
            description: 'Description of what this step does',
            taskType: 'code',
            task: 'Your task description here. Use ${VARIABLE} for variables.',
          },
          {
            id: 'step-2',
            name: 'Second Step',
            description: 'Another step',
            taskType: 'test',
            task: 'Based on previous step output: ${previous.output}',
            dependsOn: ['step-1'],
          },
        ],
      };
    }

    const content = PipelineParser.toYAML(pipeline);
    await fs.writeFile(outputPath, content, 'utf-8');

    console.log(`
✅ Pipeline created: ${outputPath}

Edit the file to customize your pipeline, then run:
   omgbuild pipe run ${name} [VARIABLES...]
`);
  });

// ============================================================================
// VALIDATE COMMAND
// ============================================================================

pipeCommand
  .command('validate <file>')
  .description('Validate a pipeline file')
  .action(async (file: string) => {
    if (!await fs.pathExists(file)) {
      console.error(`❌ File not found: ${file}`);
      process.exit(1);
    }

    try {
      const pipeline = await PipelineParser.fromFile(file);
      
      console.log(`
✅ Pipeline is valid!

Name:        ${pipeline.name}
Description: ${pipeline.description || 'none'}
Steps:       ${pipeline.steps.length}
Variables:   ${extractVariables(pipeline).join(', ') || 'none'}
`);
    } catch (error) {
      console.error(`❌ Invalid pipeline: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// ============================================================================
// HELPERS
// ============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function extractVariables(pipeline: Pipeline): string[] {
  const vars = new Set<string>();
  
  for (const step of pipeline.steps) {
    const matches = step.task.match(/\$\{(\w+)\}/g);
    if (matches) {
      for (const match of matches) {
        const varName = match.slice(2, -1);
        // Skip built-in variables
        if (!['previous', 'step'].some(p => varName.startsWith(p))) {
          vars.add(varName);
        }
      }
    }
  }

  return Array.from(vars);
}
