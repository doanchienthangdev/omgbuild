/**
 * 🔮 OMGBUILD CLI v0.6.0
 * AI-Native Software Development Operating System
 * 
 * "Big Tech Engineering Culture in a Box"
 */

import { Command } from 'commander';
import { initCommand } from './commands/init';
import { skillCommand } from './commands/skill';
import { workflowCommand } from './commands/workflow';
import { agentCommand } from './commands/agent';
import { statusCommand } from './commands/status';
import { runCommand } from './commands/run';
import { chatCommand } from './commands/chat';
import { marketplaceCommand } from './commands/marketplace';
import { cicdCommand } from './commands/cicd';
import { analyticsCommand } from './commands/analytics';
import { pluginCommand } from './commands/plugin';
// Phase 4: Command Line Orchestration Layer
import { pipeCommand } from './commands/pipe';
import { execCommand } from './commands/exec';
import { toolsCommand } from './commands/tools';
// Phase 5: Agent Mode - Big Tech Team
import { sprintCommand } from './commands/sprint';
import { backlogCommand } from './commands/backlog';
import { teamCommand } from './commands/team';
import { visionCommand } from './commands/vision';
// Phase 6: Registry Repository
import { registryCommand } from './commands/registry';
// Update command
import { updateCommand } from './commands/update';

const VERSION = '0.6.2';

const program = new Command();

program
  .name('omgbuild')
  .description('🔮 OMGBUILD - AI-Native Software Development Operating System')
  .version(VERSION, '-v, --version', 'Output the current version')
  .option('-d, --debug', 'Enable debug mode')
  .option('--no-color', 'Disable colored output')
  .option('-u, --update', 'Update to latest version from npm');

// Handle --update flag
program.hook('preAction', async (thisCommand) => {
  if (process.argv.includes('--update') || process.argv.includes('-u')) {
    const { execSync } = await import('child_process');
    console.log('🔄 Checking for updates...\n');
    
    try {
      // Get latest version from npm
      const latestVersion = execSync('npm view @anthropic-ai/omgbuild version', { encoding: 'utf-8' }).trim();
      
      if (latestVersion === VERSION) {
        console.log(`✅ Already on latest version: ${VERSION}`);
      } else {
        console.log(`📦 New version available: ${latestVersion} (current: ${VERSION})`);
        console.log('🚀 Updating...\n');
        
        execSync('npm install -g @anthropic-ai/omgbuild@latest', { stdio: 'inherit' });
        
        console.log(`\n✅ Updated to ${latestVersion}!`);
        console.log('   Run "omgbuild" to see what\'s new.');
      }
    } catch (error) {
      console.error('❌ Update failed. Try manually:');
      console.error('   npm install -g @anthropic-ai/omgbuild@latest');
    }
    
    process.exit(0);
  }
});

// Register commands
program.addCommand(initCommand);
program.addCommand(skillCommand);
program.addCommand(workflowCommand);
program.addCommand(agentCommand);
program.addCommand(statusCommand);
program.addCommand(runCommand);
program.addCommand(chatCommand);
program.addCommand(marketplaceCommand);
program.addCommand(cicdCommand);
program.addCommand(analyticsCommand);
program.addCommand(pluginCommand);
// Phase 4
program.addCommand(pipeCommand);
program.addCommand(execCommand);
program.addCommand(toolsCommand);
// Phase 5
program.addCommand(sprintCommand);
program.addCommand(backlogCommand);
program.addCommand(teamCommand);
program.addCommand(visionCommand);
// Phase 6
program.addCommand(registryCommand);
// Utility
program.addCommand(updateCommand);

// Default action - show help with style
program.action(() => {
  console.log(`
🔮 ╔═══════════════════════════════════════════════════════════════╗
   ║                     OMGBUILD v${VERSION}                           ║
   ║         AI-Native Software Development Operating System        ║
   ╚═══════════════════════════════════════════════════════════════╝

   "Big Tech Engineering Culture in a Box"

   ┌─────────────────────────────────────────────────────────────────┐
   │ 📦 REGISTRY (Phase 6 - NEW!)                                    │
   ├─────────────────────────────────────────────────────────────────┤
   │ registry pull     Pull artifacts from registry                  │
   │ registry push     Push artifacts to registry                    │
   │ registry search   Search for artifacts                          │
   │ registry sync     Sync all artifacts                            │
   └─────────────────────────────────────────────────────────────────┘

   ┌─────────────────────────────────────────────────────────────────┐
   │ 🤖 AGENT MODE (Phase 5)                                         │
   ├─────────────────────────────────────────────────────────────────┤
   │ vision           Set product vision (Product Owner)             │
   │ sprint           Sprint planning & management                   │
   │ backlog          Task & backlog management                      │
   │ team run         Start AI team working autonomously             │
   └─────────────────────────────────────────────────────────────────┘

   ┌─────────────────────────────────────────────────────────────────┐
   │ 🔧 AI EXECUTION (Phase 4)                                       │
   ├─────────────────────────────────────────────────────────────────┤
   │ exec <task>      Execute task with AI tool directly             │
   │ pipe run <n>     Run multi-step AI pipeline                     │
   │ tools            Discover & manage AI tools                     │
   └─────────────────────────────────────────────────────────────────┘

   ┌─────────────────────────────────────────────────────────────────┐
   │ ⚡ CORE COMMANDS                                                │
   ├─────────────────────────────────────────────────────────────────┤
   │ init [template]  Initialize .omgbuild/ in project               │
   │ status           Show project status and health                 │
   │ chat             Interactive AI assistant                       │
   │ marketplace      Browse & install skills                        │
   └─────────────────────────────────────────────────────────────────┘

   ┌─────────────────────────────────────────────────────────────────┐
   │ 🚀 DEVOPS                                                       │
   ├─────────────────────────────────────────────────────────────────┤
   │ cicd             Generate CI/CD pipelines                       │
   │ analytics        Productivity metrics                           │
   │ plugin           Plugin management                              │
   └─────────────────────────────────────────────────────────────────┘

   🚀 Quick Start (Agent Mode):
     $ omgbuild init enterprise        # Initialize project
     $ omgbuild vision set -i          # Set product vision
     $ omgbuild sprint new --propose   # Create sprint with AI proposals
     $ omgbuild sprint start           # Start sprint
     $ omgbuild team run               # Let AI team work!

   👥 Your AI Team:
     👔 Tech Lead    💻 Developer    🧪 QA Engineer
     🚀 DevOps       📝 Writer       🎨 Designer

   📚 Documentation: https://omgbuild.dev/docs
  `);
});

// Parse and execute
program.parse(process.argv);

// Export for programmatic use
export { program };
export * from './core/config';
export * from './core/parser';
export * from './core/orchestrator';
export * from './core/ai-provider';
export * from './core/skill-executor';
export * from './core/workflow-engine';
export * from './core/memory';
export * from './core/skill-registry';
export * from './core/analytics';
export * from './core/cicd-generator';
export * from './core/plugin-system';
// Phase 4 exports
export * from './core/adapters';
export * from './core/pipeline';
// Phase 5 exports - use named exports to avoid conflicts
export { 
  SprintManager, 
  createSprintManager, 
  Sprint, 
  Task,
  ProductVision,
  SprintConfig,
  TaskStatus,
  TaskPriority,
  TaskType as SprintTaskType,  // Renamed to avoid conflict with adapters TaskType
} from './core/agent/sprint-manager';
export {
  TeamAgent,
  createTeamAgent,
  AgentRole,
  AgentPersona,
  AGENT_PERSONAS,
} from './core/agent/team-agent';
export {
  AutonomousRunner,
  createAutonomousRunner,
  AutoMode,
  AutoRunnerConfig,
  RunSession,
} from './core/agent/autonomous-runner';
// Phase 6 exports
export {
  RegistryClient,
  createRegistryClient,
  ArtifactManifest,
  ArtifactType as RegistryArtifactType,
  RegistryConfig,
  RegistryIndex,
} from './core/registry/registry-client';
export {
  ArtifactPackager,
  createArtifactPackager,
} from './core/registry/artifact-packager';
