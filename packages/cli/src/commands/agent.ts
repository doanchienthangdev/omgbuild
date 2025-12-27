/**
 * 🔮 OMGBUILD Agent Command
 * Invoke AI agents directly
 */

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';

export const agentCommand = new Command('agent')
  .description('Invoke AI agents')
  .argument('<agent>', 'Agent to invoke: analyze, code, test, review, architect')
  .argument('[input]', 'Input for the agent')
  .option('-f, --file <file>', 'Read input from file')
  .option('-o, --output <dir>', 'Output directory')
  .option('--model <model>', 'Override AI model')
  .action(async (
    agentName: string,
    input: string | undefined,
    options: { file?: string; output?: string; model?: string }
  ) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    if (!await fs.pathExists(omgbuildDir)) {
      console.error('❌ No .omgbuild directory found. Run `omgbuild init` first.');
      process.exit(1);
    }

    await invokeAgent(omgbuildDir, agentName, input, options);
  });

async function invokeAgent(
  omgbuildDir: string,
  agentName: string,
  input: string | undefined,
  options: { file?: string; output?: string; model?: string }
) {
  // Check if skill exists for this agent
  const skillPath = path.join(omgbuildDir, 'skills', agentName, 'SKILL.md');
  
  if (!await fs.pathExists(skillPath)) {
    console.error(`❌ No skill found for agent: ${agentName}`);
    console.log('\nAvailable agents (based on installed skills):');
    
    const skillsDir = path.join(omgbuildDir, 'skills');
    if (await fs.pathExists(skillsDir)) {
      const skills = await fs.readdir(skillsDir);
      skills.forEach(s => console.log(`   • ${s}`));
    }
    process.exit(1);
  }

  // Read input from file if specified
  let inputContent = input;
  if (options.file) {
    if (!await fs.pathExists(options.file)) {
      console.error(`❌ Input file not found: ${options.file}`);
      process.exit(1);
    }
    inputContent = await fs.readFile(options.file, 'utf-8');
  }

  const skillContent = await fs.readFile(skillPath, 'utf-8');

  console.log(`
🤖 ╔═══════════════════════════════════════════════════════════════╗
   ║  AGENT: ${agentName.toUpperCase().padEnd(51)}║
   ╚═══════════════════════════════════════════════════════════════╝

   This agent is ready to assist you!
   
   Skill loaded from: .omgbuild/skills/${agentName}/SKILL.md
   ${options.model ? `Model override: ${options.model}` : ''}

${'─'.repeat(60)}

   🔮 To invoke this agent with AI:

   Option 1 - Claude Code (Recommended):
   $ claude "Act as the ${agentName} agent. Read .omgbuild/skills/${agentName}/SKILL.md and apply it to: ${inputContent || '[your input]'}"

   Option 2 - Cursor/Windsurf:
   Open your IDE and say:
   "You are the ${agentName} agent. Follow the skill definition in .omgbuild/skills/${agentName}/SKILL.md to ${inputContent || 'help with my task'}"

   Option 3 - Direct AI Model:
   Copy the skill content below and use with any AI model.

${'─'.repeat(60)}

   📋 Skill Definition Preview:
${'─'.repeat(60)}
${skillContent.split('\n').slice(0, 30).join('\n')}
${skillContent.split('\n').length > 30 ? '\n   ... (truncated, see full file)' : ''}
${'─'.repeat(60)}
`);

  // Future: Direct AI integration
  // This is where we would integrate with AI providers directly
  // For now, we provide instructions for manual integration
}
