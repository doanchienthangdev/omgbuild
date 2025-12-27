/**
 * 🔮 OMGBUILD Vision Command
 * Product Owner interface - Set product vision and goals
 */

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import readline from 'readline';
import { createSprintManager, ProductVision } from '../core/agent';

// ============================================================================
// VISION COMMAND
// ============================================================================

export const visionCommand = new Command('vision')
  .description('Product vision and goals (Product Owner interface)')
  .action(async () => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    if (!await fs.pathExists(omgbuildDir)) {
      console.log('❌ No OMGBUILD project. Run: omgbuild init');
      return;
    }

    const manager = await createSprintManager(omgbuildDir);
    const vision = manager.getVision();

    if (vision) {
      console.log(`
🔮 Product Vision
${'═'.repeat(60)}

📌 ${vision.name}

${vision.description}

🎯 Goals:
${vision.goals.map((g, i) => `   ${i + 1}. ${g}`).join('\n')}

👥 Target Users:
${vision.targetUsers.map(u => `   • ${u}`).join('\n')}
${vision.constraints?.length ? `
⚠️ Constraints:
${vision.constraints.map(c => `   • ${c}`).join('\n')}` : ''}
${vision.techStack?.length ? `
🛠️ Tech Stack:
${vision.techStack.map(t => `   • ${t}`).join('\n')}` : ''}

Last Updated: ${new Date(vision.updatedAt).toLocaleString()}

Commands:
   omgbuild vision set        Update vision
   omgbuild vision goals      Manage goals
`);
    } else {
      console.log(`
🔮 Product Vision
${'═'.repeat(60)}

No vision defined yet.

As the Product Owner, define your product vision:
   omgbuild vision set

This helps the AI team understand:
• What you're building
• Who it's for
• What success looks like
`);
    }
  });

// ============================================================================
// SET VISION
// ============================================================================

visionCommand
  .command('set')
  .description('Set or update product vision')
  .option('-n, --name <name>', 'Product name')
  .option('-d, --description <desc>', 'Product description')
  .option('-g, --goals <goals...>', 'Product goals')
  .option('-u, --users <users...>', 'Target users')
  .option('-c, --constraints <constraints...>', 'Constraints')
  .option('-t, --tech <stack...>', 'Tech stack')
  .option('-i, --interactive', 'Interactive mode')
  .action(async (options: {
    name?: string;
    description?: string;
    goals?: string[];
    users?: string[];
    constraints?: string[];
    tech?: string[];
    interactive?: boolean;
  }) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    const manager = await createSprintManager(omgbuildDir);
    const existing = manager.getVision();

    let vision: Omit<ProductVision, 'updatedAt'>;

    if (options.interactive) {
      // Interactive mode
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const ask = (question: string, defaultValue?: string): Promise<string> => {
        const prompt = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
        return new Promise((resolve) => {
          rl.question(prompt, (answer) => {
            resolve(answer.trim() || defaultValue || '');
          });
        });
      };

      const askMultiple = (question: string, existing?: string[]): Promise<string[]> => {
        return new Promise((resolve) => {
          console.log(question + ' (one per line, empty to finish)');
          if (existing?.length) {
            console.log(`Current: ${existing.join(', ')}`);
          }
          const items: string[] = [];
          
          const askLine = () => {
            rl.question('  > ', (answer) => {
              if (answer.trim() === '') {
                resolve(items.length > 0 ? items : existing || []);
              } else {
                items.push(answer.trim());
                askLine();
              }
            });
          };
          askLine();
        });
      };

      console.log(`
🔮 Product Vision Setup
${'═'.repeat(60)}

As the Product Owner, define your product vision.
This helps the AI team understand what to build.
`);

      const name = await ask('Product name', existing?.name);
      const description = await ask('Description', existing?.description);
      const goals = await askMultiple('Goals (what does success look like?)', existing?.goals);
      const targetUsers = await askMultiple('Target users', existing?.targetUsers);
      const constraints = await askMultiple('Constraints (optional)', existing?.constraints);
      const techStack = await askMultiple('Tech stack (optional)', existing?.techStack);

      rl.close();

      vision = {
        name,
        description,
        goals,
        targetUsers,
        constraints: constraints.length > 0 ? constraints : undefined,
        techStack: techStack.length > 0 ? techStack : undefined,
      };
    } else {
      // CLI options mode
      vision = {
        name: options.name || existing?.name || 'My Product',
        description: options.description || existing?.description || '',
        goals: options.goals || existing?.goals || [],
        targetUsers: options.users || existing?.targetUsers || [],
        constraints: options.constraints || existing?.constraints,
        techStack: options.tech || existing?.techStack,
      };
    }

    await manager.setVision(vision);

    console.log(`
✅ Vision Saved!

📌 ${vision.name}
${vision.description}

Goals: ${vision.goals.length}
Target Users: ${vision.targetUsers.length}

Next steps:
   omgbuild sprint new --propose   Create sprint with AI proposals
   omgbuild backlog add "task"     Add tasks manually
`);
  });

// ============================================================================
// GOALS COMMAND
// ============================================================================

const goalsCommand = new Command('goals')
  .description('Manage product goals');

goalsCommand
  .command('list')
  .description('List product goals')
  .action(async () => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    const manager = await createSprintManager(omgbuildDir);
    const vision = manager.getVision();

    if (!vision) {
      console.log('❌ No vision set. Run: omgbuild vision set');
      return;
    }

    console.log(`
🎯 Product Goals
${'═'.repeat(60)}
`);

    vision.goals.forEach((goal, i) => {
      console.log(`${i + 1}. ${goal}`);
    });

    console.log(`
Commands:
   omgbuild vision goals add "goal"     Add a goal
   omgbuild vision goals remove <num>   Remove goal by number
`);
  });

goalsCommand
  .command('add <goal>')
  .description('Add a product goal')
  .action(async (goal: string) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    const manager = await createSprintManager(omgbuildDir);
    const vision = manager.getVision();

    if (!vision) {
      console.log('❌ No vision set. Run: omgbuild vision set');
      return;
    }

    vision.goals.push(goal);
    await manager.setVision(vision);

    console.log(`✅ Goal added: ${goal}`);
  });

goalsCommand
  .command('remove <number>')
  .description('Remove a product goal')
  .action(async (number: string) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    const manager = await createSprintManager(omgbuildDir);
    const vision = manager.getVision();

    if (!vision) {
      console.log('❌ No vision set. Run: omgbuild vision set');
      return;
    }

    const index = parseInt(number) - 1;
    if (index < 0 || index >= vision.goals.length) {
      console.log('❌ Invalid goal number');
      return;
    }

    const removed = vision.goals.splice(index, 1);
    await manager.setVision(vision);

    console.log(`✅ Removed goal: ${removed[0]}`);
  });

// Set default action for goals command
goalsCommand.action(async () => {
  const omgbuildDir = path.join(process.cwd(), '.omgbuild');
  const manager = await createSprintManager(omgbuildDir);
  const vision = manager.getVision();

  if (!vision) {
    console.log('❌ No vision set. Run: omgbuild vision set');
    return;
  }

  console.log(`
🎯 Product Goals
${'═'.repeat(60)}
`);

  vision.goals.forEach((goal, i) => {
    console.log(`${i + 1}. ${goal}`);
  });

  console.log(`
Commands:
   omgbuild vision goals add "goal"     Add a goal
   omgbuild vision goals remove <num>   Remove goal by number
`);
});

visionCommand.addCommand(goalsCommand);

// ============================================================================
// REVIEW COMMAND
// ============================================================================

visionCommand
  .command('review')
  .description('Review progress against vision')
  .action(async () => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    const manager = await createSprintManager(omgbuildDir);
    const vision = manager.getVision();

    if (!vision) {
      console.log('❌ No vision set. Run: omgbuild vision set');
      return;
    }

    const sprints = manager.getSprints();
    const completedSprints = sprints.filter(s => s.status === 'completed');
    const velocityHistory = manager.getVelocityHistory();
    const avgVelocity = velocityHistory.length > 0
      ? Math.round(velocityHistory.reduce((sum, v) => sum + v.velocity, 0) / velocityHistory.length)
      : 0;

    const allTasks = manager.getBacklog();
    const doneTasks = allTasks.filter(t => t.status === 'done');

    console.log(`
🔮 Vision Progress Review
${'═'.repeat(60)}

📌 ${vision.name}

📊 Overall Progress:
   Sprints Completed: ${completedSprints.length}
   Tasks Done: ${doneTasks.length}
   Average Velocity: ${avgVelocity} pts/sprint

🎯 Goals Progress:
`);

    // Map tasks to goals (simplified - would need better tracking)
    for (let i = 0; i < vision.goals.length; i++) {
      const goal = vision.goals[i];
      // This is a placeholder - real implementation would track goal->task mapping
      console.log(`   ${i + 1}. ${goal}`);
      console.log(`      ⏳ In Progress`);
    }

    if (completedSprints.length > 0) {
      console.log(`
📈 Recent Sprints:
`);
      for (const sprint of completedSprints.slice(-3)) {
        console.log(`   • ${sprint.name}: ${sprint.completedPoints || 0} pts`);
      }
    }

    console.log(`
💡 Recommendations:
   • Continue focusing on high-priority items
   • Review blocked items weekly
   • Update vision as product evolves
`);
  });
