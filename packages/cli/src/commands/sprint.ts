/**
 * 🔮 OMGBUILD Sprint Command
 * Sprint planning and management
 */

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import readline from 'readline';
import { createSprintManager, SprintManager, Sprint, Task } from '../core/agent';

// ============================================================================
// SPRINT COMMAND
// ============================================================================

export const sprintCommand = new Command('sprint')
  .description('Sprint planning and management')
  .action(async () => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    if (!await fs.pathExists(omgbuildDir)) {
      console.log(`
❌ No OMGBUILD project found.

Run: omgbuild init
`);
      return;
    }

    const manager = await createSprintManager(omgbuildDir);
    const current = manager.getCurrentSprint();
    const progress = current ? manager.getSprintProgress(current.id) : null;

    console.log(`
🔮 OMGBUILD Sprint Management
${'═'.repeat(60)}

${current ? `
📌 Current Sprint: ${current.name}
   Goal: ${current.goal}
   Status: ${current.status}
   Progress: ${progress?.percentComplete}% (${progress?.done}/${progress?.total} tasks)
   Points: ${progress?.pointsDone}/${progress?.pointsTotal}
   Days Remaining: ${progress?.daysRemaining}
` : '📌 No active sprint'}

Commands:
  omgbuild sprint new [name]      Create new sprint
  omgbuild sprint start [id]      Start a sprint
  omgbuild sprint current         Show current sprint details
  omgbuild sprint list            List all sprints
  omgbuild sprint end             End current sprint
  omgbuild sprint retro           Add retrospective

Quick Start:
  omgbuild sprint new --propose   Create sprint with AI proposals
`);
  });

// ============================================================================
// NEW SPRINT
// ============================================================================

sprintCommand
  .command('new [name]')
  .description('Create a new sprint')
  .option('-g, --goal <goal>', 'Sprint goal')
  .option('-d, --duration <days>', 'Sprint duration in days', '14')
  .option('-p, --propose', 'Generate AI proposals for backlog')
  .option('-a, --auto-fill', 'Auto-fill sprint from backlog')
  .action(async (
    name: string | undefined,
    options: {
      goal?: string;
      duration?: string;
      propose?: boolean;
      autoFill?: boolean;
    }
  ) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    const manager = await createSprintManager(omgbuildDir);

    const sprintCount = manager.getSprints().length + 1;
    const sprintName = name || `Sprint ${sprintCount}`;

    console.log(`
🔮 Creating New Sprint: ${sprintName}
${'═'.repeat(60)}
`);

    // Generate AI proposals if requested
    if (options.propose) {
      console.log('🤖 Generating AI proposals...\n');
      
      const { createDefaultRegistry } = await import('../core/adapters');
      const { createPipelineRunner } = await import('../core/pipeline');
      const { createTeamAgent } = await import('../core/agent');

      const registry = await createDefaultRegistry();
      const runner = await createPipelineRunner(registry);
      const teamAgent = await createTeamAgent(manager, runner, registry);

      const proposals = await teamAgent.generateProposals({
        vision: manager.getVision()?.description,
        recentTasks: manager.getBacklog().slice(-5),
      });

      console.log(`✅ Generated ${proposals.length} proposals:\n`);
      for (const p of proposals) {
        console.log(`   📌 ${p.title}`);
        console.log(`      ${p.type} | ${p.priority} | ${p.storyPoints || 3} pts`);
      }
      console.log();
    }

    // Get tasks for sprint
    const backlog = manager.getBacklog({ status: 'backlog' });
    const taskIds: string[] = [];

    if (options.autoFill && backlog.length > 0) {
      // Auto-select based on velocity
      const velocityHistory = manager.getVelocityHistory();
      const targetVelocity = velocityHistory.length > 0
        ? Math.round(velocityHistory.reduce((sum, v) => sum + v.velocity, 0) / velocityHistory.length)
        : 20;

      let points = 0;
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const sorted = [...backlog].sort((a, b) => 
        priorityOrder[a.priority] - priorityOrder[b.priority]
      );

      for (const task of sorted) {
        const taskPoints = task.storyPoints || 3;
        if (points + taskPoints <= targetVelocity) {
          taskIds.push(task.id);
          points += taskPoints;
        }
      }

      console.log(`📋 Auto-selected ${taskIds.length} tasks (${points} points)\n`);
    }

    // Create sprint
    const sprint = await manager.createSprint({
      name: sprintName,
      goal: options.goal || 'Deliver value',
      duration: parseInt(options.duration || '14'),
      taskIds,
    });

    console.log(`
✅ Sprint created: ${sprint.name}
   ID: ${sprint.id}
   Duration: ${options.duration} days
   Tasks: ${sprint.tasks.length}

Next steps:
   omgbuild sprint start ${sprint.id}
   omgbuild backlog add "Task description"
   omgbuild team run
`);
  });

// ============================================================================
// START SPRINT
// ============================================================================

sprintCommand
  .command('start [id]')
  .description('Start a sprint')
  .action(async (id?: string) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    const manager = await createSprintManager(omgbuildDir);

    // If no ID, find the most recent planning sprint
    let sprintId = id;
    if (!sprintId) {
      const sprints = manager.getSprints().filter(s => s.status === 'planning');
      if (sprints.length === 0) {
        console.log('❌ No sprints in planning. Create one with: omgbuild sprint new');
        return;
      }
      sprintId = sprints[sprints.length - 1].id;
    }

    const sprint = await manager.startSprint(sprintId);
    
    if (!sprint) {
      console.log(`❌ Sprint not found: ${sprintId}`);
      return;
    }

    const progress = manager.getSprintProgress(sprint.id);

    console.log(`
🚀 Sprint Started: ${sprint.name}
${'═'.repeat(60)}

   Goal: ${sprint.goal}
   Tasks: ${progress.total}
   Points: ${progress.pointsTotal}
   End Date: ${new Date(sprint.endDate).toLocaleDateString()}

Ready to work! Commands:
   omgbuild team run              Start working on tasks
   omgbuild sprint current        View progress
   omgbuild backlog               View tasks
`);
  });

// ============================================================================
// CURRENT SPRINT
// ============================================================================

sprintCommand
  .command('current')
  .alias('status')
  .description('Show current sprint status')
  .action(async () => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    const manager = await createSprintManager(omgbuildDir);

    const sprint = manager.getCurrentSprint();
    
    if (!sprint) {
      console.log(`
📌 No active sprint.

Start one with:
   omgbuild sprint new "Sprint Name"
   omgbuild sprint start
`);
      return;
    }

    const progress = manager.getSprintProgress(sprint.id);
    const tasks = manager.getBacklog({ sprintId: sprint.id });

    // Group tasks by status
    const byStatus: Record<string, Task[]> = {
      todo: [],
      'in-progress': [],
      review: [],
      done: [],
      blocked: [],
    };

    for (const task of tasks) {
      if (byStatus[task.status]) {
        byStatus[task.status].push(task);
      }
    }

    // Progress bar
    const barWidth = 30;
    const filled = Math.round((progress.percentComplete / 100) * barWidth);
    const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);

    console.log(`
🔮 Sprint: ${sprint.name}
${'═'.repeat(60)}

📊 Progress: [${bar}] ${progress.percentComplete}%

   Goal: ${sprint.goal}
   Days Remaining: ${progress.daysRemaining}
   Points: ${progress.pointsDone}/${progress.pointsTotal}

📋 Tasks by Status:
   🔴 Todo:        ${byStatus.todo.length}
   🟡 In Progress: ${byStatus['in-progress'].length}
   🟣 Review:      ${byStatus.review.length}
   🟢 Done:        ${byStatus.done.length}
   ⚫ Blocked:     ${byStatus.blocked.length}
`);

    // Show in-progress tasks
    if (byStatus['in-progress'].length > 0) {
      console.log('\n🔄 In Progress:');
      for (const task of byStatus['in-progress']) {
        console.log(`   - ${task.title}`);
      }
    }

    // Show blocked tasks
    if (byStatus.blocked.length > 0) {
      console.log('\n⚠️ Blocked:');
      for (const task of byStatus.blocked) {
        console.log(`   - ${task.title}`);
      }
    }

    console.log(`
Commands:
   omgbuild team run        Work on tasks
   omgbuild backlog         View all tasks
   omgbuild sprint end      End sprint
`);
  });

// ============================================================================
// LIST SPRINTS
// ============================================================================

sprintCommand
  .command('list')
  .alias('ls')
  .description('List all sprints')
  .option('-a, --all', 'Show all sprints including completed')
  .action(async (options: { all?: boolean }) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    const manager = await createSprintManager(omgbuildDir);

    let sprints = manager.getSprints();
    
    if (!options.all) {
      sprints = sprints.filter(s => s.status !== 'completed');
    }

    if (sprints.length === 0) {
      console.log('No sprints found. Create one with: omgbuild sprint new');
      return;
    }

    console.log(`
🔮 Sprints
${'═'.repeat(60)}
`);

    const statusEmoji = {
      planning: '📝',
      active: '🚀',
      review: '👀',
      completed: '✅',
    };

    for (const sprint of sprints) {
      const progress = manager.getSprintProgress(sprint.id);
      console.log(`${statusEmoji[sprint.status]} ${sprint.name}`);
      console.log(`   ID: ${sprint.id}`);
      console.log(`   Status: ${sprint.status}`);
      console.log(`   Tasks: ${progress.done}/${progress.total}`);
      console.log(`   Points: ${progress.pointsDone}/${progress.pointsTotal}`);
      console.log();
    }
  });

// ============================================================================
// END SPRINT
// ============================================================================

sprintCommand
  .command('end')
  .description('End current sprint')
  .option('-f, --force', 'Force end even with incomplete tasks')
  .action(async (options: { force?: boolean }) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    const manager = await createSprintManager(omgbuildDir);

    const sprint = manager.getCurrentSprint();
    
    if (!sprint) {
      console.log('❌ No active sprint to end.');
      return;
    }

    const progress = manager.getSprintProgress(sprint.id);

    if (progress.todo > 0 || progress.inProgress > 0) {
      console.log(`
⚠️ Sprint has incomplete tasks:
   Todo: ${progress.todo}
   In Progress: ${progress.inProgress}
`);
      if (!options.force) {
        console.log('Use --force to end anyway (incomplete tasks return to backlog)');
        return;
      }
    }

    await manager.endSprint(sprint.id);

    console.log(`
✅ Sprint Ended: ${sprint.name}
${'═'.repeat(60)}

   Completed: ${progress.done} tasks
   Points Delivered: ${progress.pointsDone}
   Velocity: ${progress.pointsDone}

${progress.todo + progress.inProgress > 0 ? `
⚠️ ${progress.todo + progress.inProgress} incomplete tasks moved to backlog.
` : ''}
Next: omgbuild sprint retro (optional)
`);
  });

// ============================================================================
// RETROSPECTIVE
// ============================================================================

sprintCommand
  .command('retro [id]')
  .description('Add retrospective to a sprint')
  .action(async (id?: string) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    const manager = await createSprintManager(omgbuildDir);

    // Find sprint
    let sprint: Sprint | undefined;
    if (id) {
      sprint = manager.getSprint(id);
    } else {
      // Get most recent completed sprint
      const completed = manager.getSprints().filter(s => s.status === 'completed');
      sprint = completed[completed.length - 1];
    }

    if (!sprint) {
      console.log('❌ No completed sprint found.');
      return;
    }

    console.log(`
🔮 Sprint Retrospective: ${sprint.name}
${'═'.repeat(60)}

Enter items for each category (one per line, empty line to finish):
`);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const collectItems = (prompt: string): Promise<string[]> => {
      return new Promise((resolve) => {
        console.log(prompt);
        const items: string[] = [];
        
        const askLine = () => {
          rl.question('  > ', (answer) => {
            if (answer.trim() === '') {
              resolve(items);
            } else {
              items.push(answer.trim());
              askLine();
            }
          });
        };
        askLine();
      });
    };

    const wentWell = await collectItems('✅ What went well?');
    const needsImprovement = await collectItems('⚠️ What needs improvement?');
    const actionItems = await collectItems('📌 Action items for next sprint?');

    rl.close();

    await manager.addRetrospective(sprint.id, {
      wentWell,
      needsImprovement,
      actionItems,
    });

    console.log(`
✅ Retrospective saved!

Summary:
   ✅ Went well: ${wentWell.length} items
   ⚠️ Improve: ${needsImprovement.length} items
   📌 Actions: ${actionItems.length} items
`);
  });
