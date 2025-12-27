/**
 * 🔮 OMGBUILD Marketplace Command
 * Install, update, and manage skills from registry
 */

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { createSkillRegistry } from '../core/skill-registry';

// ============================================================================
// MARKETPLACE COMMAND
// ============================================================================

export const marketplaceCommand = new Command('marketplace')
  .alias('market')
  .alias('mp')
  .description('Install, update, and manage skills from the marketplace')
  .action(() => {
    console.log(`
🔮 OMGBUILD Skill Marketplace

Commands:
  omgbuild marketplace list              List all available skills
  omgbuild marketplace search <query>    Search for skills
  omgbuild marketplace install <skill>   Install a skill
  omgbuild marketplace uninstall <skill> Uninstall a skill
  omgbuild marketplace update [skill]    Update skill(s)
  omgbuild marketplace info <skill>      Show skill details

Examples:
  omgbuild mp list
  omgbuild mp search security
  omgbuild mp install api-design
  omgbuild mp update --all
`);
  });

// ============================================================================
// LIST COMMAND
// ============================================================================

marketplaceCommand
  .command('list')
  .alias('ls')
  .description('List all available skills')
  .option('-i, --installed', 'Show only installed skills')
  .option('-c, --category <category>', 'Filter by category')
  .action(async (options: { installed?: boolean; category?: string }) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    if (!await fs.pathExists(omgbuildDir)) {
      console.error('❌ No .omgbuild directory found. Run `omgbuild init` first.');
      process.exit(1);
    }

    const registry = await createSkillRegistry(omgbuildDir);
    const installed = registry.listInstalled();
    const installedNames = new Set(installed.map(s => s.name));

    console.log(`
🔮 OMGBUILD Skill Marketplace
${'═'.repeat(60)}
`);

    if (options.installed) {
      console.log('📦 Installed Skills:\n');
      
      if (installed.length === 0) {
        console.log('   No skills installed yet.');
        console.log('   Run `omgbuild marketplace install <skill>` to install.\n');
      } else {
        for (const skill of installed) {
          console.log(`   ✅ ${skill.name} v${skill.version}`);
          console.log(`      Source: ${skill.source} | Path: ${skill.path}\n`);
        }
      }
    } else {
      const available = await registry.listAvailable();
      let filtered = available;

      if (options.category) {
        filtered = available.filter(s => s.category === options.category);
      }

      // Group by category
      const byCategory = new Map<string, typeof filtered>();
      for (const skill of filtered) {
        const cat = skill.category;
        if (!byCategory.has(cat)) {
          byCategory.set(cat, []);
        }
        byCategory.get(cat)!.push(skill);
      }

      for (const [category, skills] of byCategory) {
        console.log(`📁 ${category.toUpperCase()}`);
        console.log('─'.repeat(40));
        
        for (const skill of skills) {
          const status = installedNames.has(skill.name) ? '✅' : '  ';
          console.log(`${status} ${skill.name.padEnd(15)} ${skill.description.slice(0, 40)}...`);
        }
        console.log();
      }

      console.log(`Total: ${filtered.length} skills | Installed: ${installed.length}`);
    }
  });

// ============================================================================
// SEARCH COMMAND
// ============================================================================

marketplaceCommand
  .command('search <query>')
  .description('Search for skills')
  .action(async (query: string) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    if (!await fs.pathExists(omgbuildDir)) {
      console.error('❌ No .omgbuild directory found. Run `omgbuild init` first.');
      process.exit(1);
    }

    const registry = await createSkillRegistry(omgbuildDir);
    const results = await registry.search(query);

    console.log(`
🔍 Search results for "${query}"
${'─'.repeat(40)}
`);

    if (results.length === 0) {
      console.log('   No skills found matching your query.\n');
    } else {
      for (const skill of results) {
        const installed = registry.isInstalled(skill.name) ? '✅' : '  ';
        console.log(`${installed} ${skill.name}`);
        console.log(`   ${skill.description}`);
        console.log(`   Category: ${skill.category} | Tags: ${skill.tags.join(', ')}`);
        console.log();
      }
    }
  });

// ============================================================================
// INSTALL COMMAND
// ============================================================================

marketplaceCommand
  .command('install <skill>')
  .alias('i')
  .description('Install a skill')
  .option('-f, --force', 'Force reinstall if exists')
  .action(async (skillName: string, options: { force?: boolean }) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    if (!await fs.pathExists(omgbuildDir)) {
      console.error('❌ No .omgbuild directory found. Run `omgbuild init` first.');
      process.exit(1);
    }

    const registry = await createSkillRegistry(omgbuildDir);

    console.log(`\n📥 Installing skill: ${skillName}...`);

    try {
      await registry.install(skillName, { force: options.force });
      
      const info = registry.getSkillInfo(skillName);
      
      console.log(`
✅ Successfully installed ${skillName} v${info?.version || '1.0.0'}

   Category: ${info?.category || 'custom'}
   ${info?.description || ''}

   Location: .omgbuild/skills/${skillName}/

Usage:
   omgbuild run skill ${skillName} "your task"
`);
    } catch (error) {
      console.error(`\n❌ Failed to install: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// ============================================================================
// UNINSTALL COMMAND
// ============================================================================

marketplaceCommand
  .command('uninstall <skill>')
  .alias('rm')
  .description('Uninstall a skill')
  .action(async (skillName: string) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    if (!await fs.pathExists(omgbuildDir)) {
      console.error('❌ No .omgbuild directory found.');
      process.exit(1);
    }

    const registry = await createSkillRegistry(omgbuildDir);

    console.log(`\n🗑️ Uninstalling skill: ${skillName}...`);

    try {
      await registry.uninstall(skillName);
      console.log(`\n✅ Successfully uninstalled ${skillName}`);
    } catch (error) {
      console.error(`\n❌ Failed to uninstall: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// ============================================================================
// UPDATE COMMAND
// ============================================================================

marketplaceCommand
  .command('update [skill]')
  .description('Update skill(s)')
  .option('-a, --all', 'Update all installed skills')
  .action(async (skillName: string | undefined, options: { all?: boolean }) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    if (!await fs.pathExists(omgbuildDir)) {
      console.error('❌ No .omgbuild directory found.');
      process.exit(1);
    }

    const registry = await createSkillRegistry(omgbuildDir);

    if (options.all || !skillName) {
      console.log('\n🔄 Updating all skills...\n');
      
      const updated = await registry.updateAll();
      
      if (updated.length === 0) {
        console.log('   No skills to update.');
      } else {
        console.log(`✅ Updated ${updated.length} skill(s):`);
        updated.forEach(s => console.log(`   • ${s}`));
      }
    } else {
      console.log(`\n🔄 Updating ${skillName}...`);
      
      try {
        await registry.update(skillName);
        console.log(`\n✅ Successfully updated ${skillName}`);
      } catch (error) {
        console.error(`\n❌ Failed to update: ${(error as Error).message}`);
        process.exit(1);
      }
    }
  });

// ============================================================================
// INFO COMMAND
// ============================================================================

marketplaceCommand
  .command('info <skill>')
  .description('Show skill details')
  .action(async (skillName: string) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    if (!await fs.pathExists(omgbuildDir)) {
      console.error('❌ No .omgbuild directory found.');
      process.exit(1);
    }

    const registry = await createSkillRegistry(omgbuildDir);
    const info = registry.getSkillInfo(skillName);
    const installed = registry.isInstalled(skillName);

    if (!info) {
      console.error(`\n❌ Skill not found: ${skillName}`);
      process.exit(1);
    }

    console.log(`
🔮 Skill: ${info.name}
${'═'.repeat(50)}

   Version:     ${info.version}
   Author:      ${info.author}
   License:     ${info.license}
   Category:    ${info.category}
   Status:      ${installed ? '✅ Installed' : '❌ Not installed'}

   Description:
   ${info.description}

   Tags:
   ${info.tags.map(t => `#${t}`).join('  ')}

   AI Configuration:
   • Model:     ${info.ai.recommended_model}
   • Min Tokens: ${info.ai.min_tokens}
   • Streaming:  ${info.ai.supports_streaming ? 'Yes' : 'No'}

${!installed ? `
   Install with:
   $ omgbuild marketplace install ${info.name}
` : `
   Use with:
   $ omgbuild run skill ${info.name} "your task"
`}
`);
  });
