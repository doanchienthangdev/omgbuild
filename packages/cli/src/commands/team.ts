/**
 * 🔮 OMGBUILD Team Command
 * AI Team Agent interface - Your Big Tech development team
 */

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { 
  createSprintManager, 
  createTeamAgent, 
  createAutonomousRunner,
  AGENT_PERSONAS,
  AgentRole,
  Task,
} from '../core/agent';
import { createDefaultRegistry } from '../core/adapters';
import { createPipelineRunner } from '../core/pipeline';

// ============================================================================
// TEAM COMMAND
// ============================================================================

export const teamCommand = new Command('team')
  .description('AI Team Agent - Your Big Tech development team')
  .action(async () => {
    console.log(`
🔮 OMGBUILD AI Team
${'═'.repeat(60)}

Your virtual Big Tech development team:

   👔 Alex (Tech Lead)      Architecture, reviews, decisions
   💻 Sam (Developer)       Implementation, debugging
   🧪 Jordan (QA)           Testing, security, quality
   🚀 Morgan (DevOps)       CI/CD, infrastructure
   📝 Casey (Writer)        Documentation
   🎨 Riley (Designer)      UI/UX, frontend

Commands:
   omgbuild team run              Start autonomous work
   omgbuild team run --task <id>  Work on specific task
   omgbuild team status           Show team status
   omgbuild team ask "question"   Ask the team
   omgbuild team assign <id>      Assign task to agent

Modes:
   --mode full-auto    Fully autonomous (minimal prompts)
   --mode semi-auto    Pause at decisions (default)
   --mode manual       Confirm each step

Example:
   omgbuild team run --mode semi-auto
`);
  });

// ============================================================================
// RUN COMMAND
// ============================================================================

teamCommand
  .command('run')
  .description('Start the AI team working on tasks')
  .option('-t, --task <id>', 'Work on specific task')
  .option('-m, --mode <mode>', 'Automation mode (full-auto|semi-auto|manual)', 'semi-auto')
  .option('-n, --max <count>', 'Maximum tasks to process', '5')
  .option('-v, --verbose', 'Verbose output')
  .option('-i, --interactive', 'Interactive mode')
  .action(async (options: {
    task?: string;
    mode?: string;
    max?: string;
    verbose?: boolean;
    interactive?: boolean;
  }) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    if (!await fs.pathExists(omgbuildDir)) {
      console.log('❌ No OMGBUILD project. Run: omgbuild init');
      return;
    }

    console.log(`
🔮 OMGBUILD AI Team Starting
${'═'.repeat(60)}

Mode: ${options.mode || 'semi-auto'}
Max Tasks: ${options.max || 5}
`);

    console.log('🔧 Initializing team...\n');

    try {
      // Initialize components
      const manager = await createSprintManager(omgbuildDir);
      const registry = await createDefaultRegistry();
      const available = await registry.getAvailable();

      if (available.length === 0) {
        console.log(`
❌ No AI tools available!

The team needs AI tools to work. Install at least one:
   npm install -g @anthropic-ai/claude-code
   npm install -g @openai/codex
   pip install aider-chat

Then run: omgbuild tools discover
`);
        return;
      }

      console.log(`✅ Tools available: ${available.map(t => t.name).join(', ')}\n`);

      const runner = await createPipelineRunner(registry);
      const teamAgent = await createTeamAgent(manager, runner, registry);
      const autoRunner = createAutonomousRunner(manager, teamAgent, {
        mode: options.mode as any || 'semi-auto',
        maxTasksPerRun: parseInt(options.max || '5'),
      });

      // Check for specific task
      if (options.task) {
        const task = manager.getTask(options.task);
        if (!task) {
          console.log(`❌ Task not found: ${options.task}`);
          return;
        }

        console.log(`📌 Working on: ${task.title}\n`);
        
        const team = teamAgent.getTaskTeam(task);
        console.log(`👥 Team: ${team.map(r => `${AGENT_PERSONAS[r].emoji} ${AGENT_PERSONAS[r].name}`).join(', ')}\n`);

        const result = await teamAgent.executeTask(task, {
          verbose: options.verbose,
        });

        if (result.success) {
          console.log('\n✅ Task completed successfully!');
        } else {
          console.log('\n❌ Task failed. Check the output above.');
        }

        return;
      }

      // Run sprint/backlog
      const sprint = manager.getCurrentSprint();
      
      if (!sprint) {
        console.log(`
📋 No active sprint.

Options:
1. Create and start a sprint:
   omgbuild sprint new "Sprint 1" --propose
   omgbuild sprint start

2. Work directly on backlog:
   omgbuild backlog add "Your task"
   omgbuild team run --task <id>
`);
        return;
      }

      console.log(`🚀 Sprint: ${sprint.name}`);
      console.log(`   Goal: ${sprint.goal}\n`);

      // Run
      if (options.interactive) {
        await autoRunner.runInteractive();
      } else {
        await autoRunner.run({
          onTaskStart: (task) => {
            console.log(`\n📌 Starting: ${task.title}`);
            const team = teamAgent.getTaskTeam(task);
            console.log(`   Team: ${team.map(r => AGENT_PERSONAS[r].emoji).join(' ')}`);
          },
          onAgentOutput: (agent, chunk) => {
            if (options.verbose) {
              process.stdout.write(chunk);
            }
          },
          onTaskComplete: (task, success) => {
            if (success) {
              console.log(`   ✅ Completed`);
            } else {
              console.log(`   ❌ Failed`);
            }
          },
        });
      }

    } catch (error) {
      console.error(`\n❌ Error: ${(error as Error).message}`);
      if (options.verbose) {
        console.error(error);
      }
    }
  });

// ============================================================================
// STATUS COMMAND
// ============================================================================

teamCommand
  .command('status')
  .description('Show team status')
  .action(async () => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    const manager = await createSprintManager(omgbuildDir);

    const sprint = manager.getCurrentSprint();
    const progress = sprint ? manager.getSprintProgress(sprint.id) : null;

    console.log(`
🔮 AI Team Status
${'═'.repeat(60)}

${sprint ? `📌 Current Sprint: ${sprint.name}
   Progress: ${progress?.percentComplete}% (${progress?.done}/${progress?.total} tasks)
   Points: ${progress?.pointsDone}/${progress?.pointsTotal}
` : '📌 No active sprint'}

👥 Team Members:
`);

    for (const [role, persona] of Object.entries(AGENT_PERSONAS)) {
      console.log(`   ${persona.emoji} ${persona.name}`);
      console.log(`      ${persona.responsibilities.slice(0, 2).join(', ')}`);
    }

    // Show blocked items
    const blocked = manager.getBacklog({ status: 'blocked' });
    if (blocked.length > 0) {
      console.log('\n⚠️ Blockers:');
      for (const task of blocked) {
        console.log(`   - ${task.title}`);
      }
    }

    console.log(`
Commands:
   omgbuild team run        Start working
   omgbuild sprint current  Sprint details
   omgbuild backlog         View tasks
`);
  });

// ============================================================================
// ASK COMMAND
// ============================================================================

teamCommand
  .command('ask <question>')
  .description('Ask the team a question')
  .option('-r, --role <role>', 'Ask specific team member')
  .action(async (question: string, options: { role?: AgentRole }) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');

    console.log(`
🔮 Asking the team...
${'═'.repeat(60)}
`);

    try {
      const registry = await createDefaultRegistry();
      const available = await registry.getAvailable();

      if (available.length === 0) {
        console.log('❌ No AI tools available.');
        return;
      }

      const tool = await registry.findBestTool('chat');
      if (!tool) {
        console.log('❌ No chat-capable tool available.');
        return;
      }

      // Determine which agent should answer
      const role: AgentRole = options.role || inferBestAgent(question);
      const persona = AGENT_PERSONAS[role];

      console.log(`${persona.emoji} ${persona.name} responding...\n`);

      const result = await tool.execute({
        task: `${persona.systemPrompt}\n\n---\n\nQuestion: ${question}`,
        taskType: 'chat',
        projectRoot: process.cwd(),
        omgbuildDir,
      }, {
        onOutput: (chunk) => {
          process.stdout.write(chunk);
        },
      });

      console.log('\n');

    } catch (error) {
      console.error(`\n❌ Error: ${(error as Error).message}`);
    }
  });

// ============================================================================
// ASSIGN COMMAND
// ============================================================================

teamCommand
  .command('assign <taskId> [role]')
  .description('Assign a task to a team member')
  .action(async (taskId: string, role?: string) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    const manager = await createSprintManager(omgbuildDir);

    const task = manager.getTask(taskId);
    if (!task) {
      console.log(`❌ Task not found: ${taskId}`);
      return;
    }

    // Auto-assign if no role specified
    const registry = await createDefaultRegistry();
    const runner = await createPipelineRunner(registry);
    const teamAgent = await createTeamAgent(manager, runner, registry);

    const assignedRole = role as AgentRole || teamAgent.getBestAgent(task);
    const persona = AGENT_PERSONAS[assignedRole];

    if (!persona) {
      console.log(`❌ Unknown role: ${role}`);
      console.log(`Available: ${Object.keys(AGENT_PERSONAS).join(', ')}`);
      return;
    }

    await manager.updateTask(taskId, { assignee: assignedRole });

    console.log(`
✅ Task Assigned

   Task: ${task.title}
   Assignee: ${persona.emoji} ${persona.name}
   Role: ${assignedRole}

Run: omgbuild team run --task ${taskId}
`);
  });

// ============================================================================
// MEMBERS COMMAND
// ============================================================================

teamCommand
  .command('members')
  .alias('roster')
  .description('Show team member details')
  .action(async () => {
    console.log(`
🔮 AI Team Roster
${'═'.repeat(60)}
`);

    for (const [role, persona] of Object.entries(AGENT_PERSONAS)) {
      console.log(`${persona.emoji} ${persona.name}`);
      console.log(`   Role: ${role}`);
      console.log(`   ${persona.description}`);
      console.log(`   Responsibilities:`);
      persona.responsibilities.forEach(r => console.log(`     • ${r}`));
      console.log(`   Skills: ${persona.skills.join(', ')}`);
      console.log(`   Task Types: ${persona.taskTypes.join(', ')}`);
      console.log();
    }
  });

// ============================================================================
// HELPERS
// ============================================================================

function inferBestAgent(question: string): AgentRole {
  const q = question.toLowerCase();

  if (q.includes('architect') || q.includes('design') || q.includes('decision')) {
    return 'tech-lead';
  }
  if (q.includes('test') || q.includes('qa') || q.includes('security') || q.includes('bug')) {
    return 'qa';
  }
  if (q.includes('deploy') || q.includes('ci') || q.includes('docker') || q.includes('infra')) {
    return 'devops';
  }
  if (q.includes('doc') || q.includes('readme') || q.includes('api doc')) {
    return 'writer';
  }
  if (q.includes('ui') || q.includes('ux') || q.includes('frontend') || q.includes('css')) {
    return 'designer';
  }
  if (q.includes('implement') || q.includes('code') || q.includes('function')) {
    return 'developer';
  }

  return 'tech-lead';  // Default to tech lead for general questions
}
