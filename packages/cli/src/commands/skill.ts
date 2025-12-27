/**
 * 🔮 OMGBUILD Skill Command
 * Manage AI skills
 */

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';

export const skillCommand = new Command('skill')
  .description('Manage AI skills')
  .argument('<action>', 'Action: list, info, add, remove, run')
  .argument('[skill]', 'Skill name')
  .option('-v, --verbose', 'Show detailed output')
  .action(async (action: string, skill: string | undefined, options: { verbose?: boolean }) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    if (!await fs.pathExists(omgbuildDir)) {
      console.error('❌ No .omgbuild directory found. Run `omgbuild init` first.');
      process.exit(1);
    }

    switch (action) {
      case 'list':
        await listSkills(omgbuildDir, options.verbose);
        break;
      case 'info':
        if (!skill) {
          console.error('❌ Skill name required. Usage: omgbuild skill info <skill>');
          process.exit(1);
        }
        await showSkillInfo(omgbuildDir, skill);
        break;
      case 'run':
        if (!skill) {
          console.error('❌ Skill name required. Usage: omgbuild skill run <skill>');
          process.exit(1);
        }
        await runSkill(omgbuildDir, skill);
        break;
      case 'add':
        console.log('📦 Skill marketplace coming soon!');
        break;
      case 'remove':
        console.log('🗑️ Skill removal coming soon!');
        break;
      default:
        console.error(`❌ Unknown action: ${action}`);
        console.log('Available actions: list, info, add, remove, run');
        process.exit(1);
    }
  });

async function listSkills(omgbuildDir: string, verbose?: boolean) {
  const skillsDir = path.join(omgbuildDir, 'skills');
  
  if (!await fs.pathExists(skillsDir)) {
    console.log('📭 No skills installed.');
    return;
  }

  const skills = await fs.readdir(skillsDir);
  
  console.log(`
🔮 Installed Skills
${'─'.repeat(40)}
`);

  for (const skill of skills) {
    const skillPath = path.join(skillsDir, skill, 'SKILL.md');
    if (await fs.pathExists(skillPath)) {
      const content = await fs.readFile(skillPath, 'utf-8');
      const purposeMatch = content.match(/## Purpose\n(.+)/);
      const purpose = purposeMatch ? purposeMatch[1].trim() : 'No description';
      
      console.log(`   • ${skill.padEnd(15)} ${purpose}`);
      
      if (verbose) {
        const capabilities = content.match(/## Capabilities\n([\s\S]*?)(?=\n## )/);
        if (capabilities) {
          console.log(`     ${capabilities[1].trim().split('\n').slice(0, 3).join('\n     ')}`);
        }
        console.log();
      }
    }
  }

  console.log(`
${'─'.repeat(40)}
   Total: ${skills.length} skills

   Use 'omgbuild skill info <skill>' for details
   Use 'omgbuild skill run <skill>' to execute
`);
}

async function showSkillInfo(omgbuildDir: string, skillName: string) {
  const skillPath = path.join(omgbuildDir, 'skills', skillName, 'SKILL.md');
  
  if (!await fs.pathExists(skillPath)) {
    console.error(`❌ Skill not found: ${skillName}`);
    console.log(`\nAvailable skills:`);
    const skillsDir = path.join(omgbuildDir, 'skills');
    const skills = await fs.readdir(skillsDir);
    skills.forEach(s => console.log(`   • ${s}`));
    process.exit(1);
  }

  const content = await fs.readFile(skillPath, 'utf-8');
  console.log(content);
}

async function runSkill(omgbuildDir: string, skillName: string) {
  const skillPath = path.join(omgbuildDir, 'skills', skillName, 'SKILL.md');
  
  if (!await fs.pathExists(skillPath)) {
    console.error(`❌ Skill not found: ${skillName}`);
    process.exit(1);
  }

  console.log(`
🔮 Running skill: ${skillName}
${'─'.repeat(40)}

This skill is designed to be used with AI agents.

To use this skill:
1. Open your AI-powered IDE (Cursor, Claude Code, etc.)
2. Reference the skill: "Use the ${skillName} skill from .omgbuild"
3. Provide your input

Or use with Claude Code:
  claude "Read .omgbuild/skills/${skillName}/SKILL.md and apply it to [your task]"

${'─'.repeat(40)}
`);

  // In future: interactive mode with AI integration
}
