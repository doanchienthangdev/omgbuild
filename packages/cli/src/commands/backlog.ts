/**
 * 🔮 OMGBUILD Backlog Command
 * Task and backlog management
 */

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { createSprintManager, Task, TaskType, TaskPriority, TaskStatus } from '../core/agent';

// ============================================================================
// BACKLOG COMMAND
// ============================================================================

export const backlogCommand = new Command('backlog')
  .description('Task and backlog management')
  .option('-s, --status <status>', 'Filter by status')
  .option('-p, --priority <priority>', 'Filter by priority')
  .option('-t, --type <type>', 'Filter by type')
  .action(async (options: {
    status?: TaskStatus;
    priority?: TaskPriority;
    type?: TaskType;
  }) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    if (!await fs.pathExists(omgbuildDir)) {
      console.log('❌ No OMGBUILD project. Run: omgbuild init');
      return;
    }

    const manager = await createSprintManager(omgbuildDir);
    const tasks = manager.getBacklog(options);

    console.log(`
🔮 Backlog (${tasks.length} tasks)
${'═'.repeat(60)}
`);

    if (tasks.length === 0) {
      console.log(`No tasks found.

Add tasks with:
   omgbuild backlog add "Task title"
   omgbuild backlog add "Task" --type feature --priority high
`);
      return;
    }

    // Group by status
    const byStatus: Record<string, Task[]> = {};
    for (const task of tasks) {
      if (!byStatus[task.status]) {
        byStatus[task.status] = [];
      }
      byStatus[task.status].push(task);
    }

    const statusOrder = ['backlog', 'todo', 'in-progress', 'review', 'done', 'blocked'];
    const statusEmoji: Record<string, string> = {
      backlog: '📋',
      todo: '🔴',
      'in-progress': '🟡',
      review: '🟣',
      done: '🟢',
      blocked: '⚫',
    };

    const priorityEmoji: Record<string, string> = {
      critical: '🔥',
      high: '🔴',
      medium: '🟡',
      low: '🔵',
    };

    for (const status of statusOrder) {
      if (!byStatus[status]) continue;

      console.log(`${statusEmoji[status]} ${status.toUpperCase()} (${byStatus[status].length})`);
      
      for (const task of byStatus[status]) {
        const priority = priorityEmoji[task.priority] || '';
        const points = task.storyPoints ? `[${task.storyPoints}pts]` : '';
        console.log(`   ${priority} ${task.title} ${points}`);
        console.log(`      ID: ${task.id} | Type: ${task.type}`);
      }
      console.log();
    }

    console.log(`
Commands:
   omgbuild backlog add "title"     Add task
   omgbuild backlog show <id>       Task details
   omgbuild backlog update <id>     Update task
   omgbuild backlog move <id>       Change status
`);
  });

// ============================================================================
// ADD TASK
// ============================================================================

backlogCommand
  .command('add <title>')
  .description('Add a new task to backlog')
  .option('-d, --description <desc>', 'Task description')
  .option('-t, --type <type>', 'Task type (feature|bugfix|refactor|docs|test|devops|research)', 'feature')
  .option('-p, --priority <priority>', 'Priority (critical|high|medium|low)', 'medium')
  .option('-s, --points <points>', 'Story points', '3')
  .option('-a, --criteria <criteria...>', 'Acceptance criteria')
  .option('-l, --labels <labels...>', 'Labels')
  .action(async (
    title: string,
    options: {
      description?: string;
      type?: string;
      priority?: string;
      points?: string;
      criteria?: string[];
      labels?: string[];
    }
  ) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    const manager = await createSprintManager(omgbuildDir);

    const task = await manager.addTask({
      title,
      description: options.description || title,
      type: options.type as TaskType || 'feature',
      priority: options.priority as TaskPriority || 'medium',
      storyPoints: parseInt(options.points || '3'),
      acceptanceCriteria: options.criteria,
      labels: options.labels,
      source: 'user',
    });

    console.log(`
✅ Task Created
${'═'.repeat(40)}

   ID: ${task.id}
   Title: ${task.title}
   Type: ${task.type}
   Priority: ${task.priority}
   Points: ${task.storyPoints}

Next:
   omgbuild backlog show ${task.id}
   omgbuild sprint start (to work on it)
`);
  });

// ============================================================================
// SHOW TASK
// ============================================================================

backlogCommand
  .command('show <id>')
  .description('Show task details')
  .action(async (id: string) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    const manager = await createSprintManager(omgbuildDir);

    const task = manager.getTask(id);
    
    if (!task) {
      console.log(`❌ Task not found: ${id}`);
      return;
    }

    console.log(`
🔮 Task: ${task.title}
${'═'.repeat(60)}

   ID: ${task.id}
   Type: ${task.type}
   Status: ${task.status}
   Priority: ${task.priority}
   Points: ${task.storyPoints || 'Not estimated'}
   Source: ${task.source}

📝 Description:
   ${task.description}
`);

    if (task.acceptanceCriteria?.length) {
      console.log('✅ Acceptance Criteria:');
      task.acceptanceCriteria.forEach((c, i) => {
        console.log(`   ${i + 1}. ${c}`);
      });
      console.log();
    }

    if (task.labels?.length) {
      console.log(`🏷️ Labels: ${task.labels.join(', ')}\n`);
    }

    if (task.dependencies?.length) {
      console.log(`🔗 Dependencies: ${task.dependencies.join(', ')}\n`);
    }

    if (task.aiContext) {
      console.log('🤖 AI Context:');
      if (task.aiContext.analysisResult) {
        console.log('   ✓ Has analysis');
      }
      if (task.aiContext.implementationPlan) {
        console.log('   ✓ Has implementation plan');
      }
      if (task.aiContext.reviewFeedback) {
        console.log('   ✓ Has review feedback');
      }
      console.log();
    }

    console.log(`📅 Timeline:
   Created: ${new Date(task.createdAt).toLocaleString()}
   Updated: ${new Date(task.updatedAt).toLocaleString()}
${task.startedAt ? `   Started: ${new Date(task.startedAt).toLocaleString()}` : ''}
${task.completedAt ? `   Completed: ${new Date(task.completedAt).toLocaleString()}` : ''}
`);
  });

// ============================================================================
// UPDATE TASK
// ============================================================================

backlogCommand
  .command('update <id>')
  .description('Update a task')
  .option('-t, --title <title>', 'New title')
  .option('-d, --description <desc>', 'New description')
  .option('-p, --priority <priority>', 'New priority')
  .option('-s, --points <points>', 'Story points')
  .option('-a, --assignee <role>', 'Assign to agent role')
  .action(async (
    id: string,
    options: {
      title?: string;
      description?: string;
      priority?: TaskPriority;
      points?: string;
      assignee?: string;
    }
  ) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    const manager = await createSprintManager(omgbuildDir);

    const updates: Partial<Task> = {};
    if (options.title) updates.title = options.title;
    if (options.description) updates.description = options.description;
    if (options.priority) updates.priority = options.priority;
    if (options.points) updates.storyPoints = parseInt(options.points);
    if (options.assignee) updates.assignee = options.assignee;

    const task = await manager.updateTask(id, updates);
    
    if (!task) {
      console.log(`❌ Task not found: ${id}`);
      return;
    }

    console.log(`✅ Task updated: ${task.title}`);
  });

// ============================================================================
// MOVE TASK
// ============================================================================

backlogCommand
  .command('move <id> <status>')
  .description('Move task to new status')
  .action(async (id: string, status: TaskStatus) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    const manager = await createSprintManager(omgbuildDir);

    const validStatuses = ['backlog', 'todo', 'in-progress', 'review', 'done', 'blocked'];
    if (!validStatuses.includes(status)) {
      console.log(`❌ Invalid status. Use: ${validStatuses.join(', ')}`);
      return;
    }

    const task = await manager.updateTask(id, { status });
    
    if (!task) {
      console.log(`❌ Task not found: ${id}`);
      return;
    }

    console.log(`✅ Moved "${task.title}" to ${status}`);
  });

// ============================================================================
// PROPOSE TASKS
// ============================================================================

backlogCommand
  .command('propose')
  .description('Generate AI task proposals')
  .option('-c, --count <count>', 'Number of proposals', '5')
  .action(async (options: { count?: string }) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    const manager = await createSprintManager(omgbuildDir);

    console.log('🤖 Generating AI proposals...\n');

    try {
      const { createDefaultRegistry } = await import('../core/adapters');
      const { createPipelineRunner } = await import('../core/pipeline');
      const { createTeamAgent } = await import('../core/agent');

      const registry = await createDefaultRegistry();
      const available = await registry.getAvailable();

      if (available.length === 0) {
        console.log(`
❌ No AI tools available.

Install at least one:
   npm install -g @anthropic-ai/claude-code
   pip install aider-chat
`);
        return;
      }

      const runner = await createPipelineRunner(registry);
      const teamAgent = await createTeamAgent(manager, runner, registry);

      const proposals = await teamAgent.generateProposals({
        vision: manager.getVision()?.description,
        recentTasks: manager.getBacklog().slice(-5),
      });

      console.log(`✅ Generated ${proposals.length} proposals:\n`);

      for (const proposal of proposals) {
        console.log(`📌 ${proposal.title}`);
        console.log(`   Type: ${proposal.type} | Priority: ${proposal.priority} | ${proposal.storyPoints} pts`);
        console.log(`   ${proposal.description.slice(0, 100)}...`);
        console.log(`   ID: ${proposal.id}`);
        console.log();
      }

      console.log(`
Tasks added to backlog. Review with:
   omgbuild backlog show <id>
`);
    } catch (error) {
      console.error(`❌ Error: ${(error as Error).message}`);
    }
  });

// ============================================================================
// PRIORITIZE
// ============================================================================

backlogCommand
  .command('prioritize')
  .description('Interactively prioritize backlog')
  .action(async () => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    const manager = await createSprintManager(omgbuildDir);

    const tasks = manager.getBacklog({ status: 'backlog' });
    
    if (tasks.length === 0) {
      console.log('No tasks in backlog to prioritize.');
      return;
    }

    console.log(`
🔮 Backlog Prioritization
${'═'.repeat(60)}

Current order (${tasks.length} tasks):
`);

    tasks.forEach((task, i) => {
      const priorityEmoji: Record<string, string> = {
        critical: '🔥',
        high: '🔴',
        medium: '🟡',
        low: '🔵',
      };
      console.log(`${i + 1}. ${priorityEmoji[task.priority]} ${task.title} [${task.storyPoints || 3}pts]`);
    });

    console.log(`
To reorder, use:
   omgbuild backlog update <id> --priority <critical|high|medium|low>
`);
  });
