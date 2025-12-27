/**
 * 🔮 OMGBUILD Workflow Command
 * Execute development workflows
 */

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';

interface WorkflowStage {
  id: string;
  name: string;
  skill?: string;
  depends_on?: string[];
}

interface Workflow {
  name: string;
  description: string;
  stages: WorkflowStage[];
}

export const workflowCommand = new Command('workflow')
  .description('Run development workflows')
  .argument('<workflow>', 'Workflow to run: feature, bugfix, sprint, release')
  .argument('[description]', 'Description for the workflow')
  .option('--dry-run', 'Show what would happen without executing')
  .option('--stage <stage>', 'Start from specific stage')
  .action(async (
    workflowName: string,
    description: string | undefined,
    options: { dryRun?: boolean; stage?: string }
  ) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    if (!await fs.pathExists(omgbuildDir)) {
      console.error('❌ No .omgbuild directory found. Run `omgbuild init` first.');
      process.exit(1);
    }

    await runWorkflow(omgbuildDir, workflowName, description, options);
  });

async function runWorkflow(
  omgbuildDir: string,
  workflowName: string,
  description: string | undefined,
  options: { dryRun?: boolean; stage?: string }
) {
  // List available workflows
  if (workflowName === 'list') {
    await listWorkflows(omgbuildDir);
    return;
  }

  const workflowPath = path.join(omgbuildDir, 'workflows', `${workflowName}.yaml`);
  
  if (!await fs.pathExists(workflowPath)) {
    console.error(`❌ Workflow not found: ${workflowName}`);
    console.log('\nAvailable workflows:');
    await listWorkflows(omgbuildDir);
    process.exit(1);
  }

  const content = await fs.readFile(workflowPath, 'utf-8');
  const workflow = yaml.load(content) as Workflow;

  console.log(`
🔮 ╔═══════════════════════════════════════════════════════════════╗
   ║  WORKFLOW: ${workflow.name.toUpperCase().padEnd(47)}║
   ╚═══════════════════════════════════════════════════════════════╝

   📋 ${workflow.description}
   ${description ? `\n   📝 Task: "${description}"` : ''}
   ${options.dryRun ? '\n   🔍 DRY RUN MODE' : ''}

   Stages:
${'─'.repeat(60)}
`);

  // Display stages
  for (let i = 0; i < workflow.stages.length; i++) {
    const stage = workflow.stages[i];
    const stageNum = (i + 1).toString().padStart(2, '0');
    const deps = stage.depends_on ? ` (after: ${stage.depends_on.join(', ')})` : '';
    
    console.log(`   ${stageNum}. ${stage.name}${deps}`);
    
    if (stage.skill) {
      console.log(`       └─ Skill: ${stage.skill}`);
    }
  }

  console.log(`
${'─'.repeat(60)}

   📂 Artifacts will be saved to:
      .omgbuild/generated/${workflowName}s/${Date.now()}/

   🤖 To execute this workflow with AI:

   Option 1 - Claude Code:
   $ claude "Execute the ${workflowName} workflow from .omgbuild for: ${description || '[your description]'}"

   Option 2 - Cursor/IDE:
   Open IDE and reference:
   "Follow .omgbuild/workflows/${workflowName}.yaml to ${description || 'complete this task'}"

   Option 3 - Step by step:
`);

  // Show step-by-step instructions
  for (let i = 0; i < workflow.stages.length; i++) {
    const stage = workflow.stages[i];
    console.log(`   ${i + 1}. ${stage.name}`);
    if (stage.skill) {
      console.log(`      $ omgbuild skill run ${stage.skill}`);
    }
  }

  console.log(`
${'─'.repeat(60)}
   
   Tip: Use AI agents to automate these steps!
`);

  // Create artifact directory
  if (!options.dryRun) {
    const artifactDir = path.join(
      omgbuildDir, 
      'generated', 
      `${workflowName}s`, 
      `${Date.now()}`
    );
    await fs.ensureDir(artifactDir);
    
    // Write workflow context
    const contextPath = path.join(artifactDir, 'context.yaml');
    await fs.writeFile(contextPath, yaml.dump({
      workflow: workflowName,
      description: description || '',
      started_at: new Date().toISOString(),
      status: 'in_progress',
      current_stage: workflow.stages[0]?.id || '',
    }));
    
    console.log(`   ✅ Workflow context saved to: ${contextPath}\n`);
  }
}

async function listWorkflows(omgbuildDir: string) {
  const workflowsDir = path.join(omgbuildDir, 'workflows');
  
  if (!await fs.pathExists(workflowsDir)) {
    console.log('📭 No workflows configured.');
    return;
  }

  const files = await fs.readdir(workflowsDir);
  const workflows = files.filter(f => f.endsWith('.yaml'));

  console.log(`
🔮 Available Workflows
${'─'.repeat(40)}
`);

  for (const file of workflows) {
    const content = await fs.readFile(path.join(workflowsDir, file), 'utf-8');
    const workflow = yaml.load(content) as Workflow;
    const name = file.replace('.yaml', '');
    
    console.log(`   • ${name.padEnd(15)} ${workflow.description || ''}`);
  }

  console.log(`
${'─'.repeat(40)}
   Usage: omgbuild workflow <name> "description"
`);
}
