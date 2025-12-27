/**
 * 🔮 OMGBUILD Status Command
 * Show project status and health
 */

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';

interface Config {
  project: {
    name: string;
    type: string;
    version: string;
  };
  skills: {
    enabled: string[];
  };
}

export const statusCommand = new Command('status')
  .description('Show project status and health')
  .option('-v, --verbose', 'Show detailed status')
  .action(async (options: { verbose?: boolean }) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    if (!await fs.pathExists(omgbuildDir)) {
      console.error('❌ No .omgbuild directory found. Run `omgbuild init` first.');
      process.exit(1);
    }

    await showStatus(omgbuildDir, options.verbose);
  });

async function showStatus(omgbuildDir: string, verbose?: boolean) {
  // Load config
  const configPath = path.join(omgbuildDir, 'config.yaml');
  let config: Config | null = null;
  
  if (await fs.pathExists(configPath)) {
    const content = await fs.readFile(configPath, 'utf-8');
    config = yaml.load(content) as Config;
  }

  // Count items in each directory
  const counts = {
    skills: await countItems(path.join(omgbuildDir, 'skills')),
    workflows: await countItems(path.join(omgbuildDir, 'workflows')),
    rules: await countItems(path.join(omgbuildDir, 'rules')),
    templates: await countItems(path.join(omgbuildDir, 'templates')),
    decisions: await countItems(path.join(omgbuildDir, 'memory', 'decisions')),
    patterns: await countItems(path.join(omgbuildDir, 'memory', 'patterns')),
    generated: await countItems(path.join(omgbuildDir, 'generated')),
  };

  // Calculate health score
  const healthScore = calculateHealthScore(counts);

  console.log(`
🔮 ╔═══════════════════════════════════════════════════════════════╗
   ║                    OMGBUILD STATUS                             ║
   ╚═══════════════════════════════════════════════════════════════╝

   📁 Project:    ${config?.project.name || 'Unknown'}
   📦 Template:   ${config?.project.type || 'Unknown'}
   🏷️  Version:    ${config?.project.version || '0.0.0'}
   
   ❤️  Health:     ${healthScore}% ${getHealthEmoji(healthScore)}

${'─'.repeat(60)}
   📊 OMGBUILD Components
${'─'.repeat(60)}

   ${getBar(counts.skills, 10)} Skills:     ${counts.skills} installed
   ${getBar(counts.workflows, 5)} Workflows:  ${counts.workflows} configured
   ${getBar(counts.rules, 5)} Rules:      ${counts.rules} defined
   ${getBar(counts.templates, 5)} Templates:  ${counts.templates} available

${'─'.repeat(60)}
   🧠 Project Memory
${'─'.repeat(60)}

   ${getBar(counts.decisions, 20)} Decisions:  ${counts.decisions} recorded
   ${getBar(counts.patterns, 20)} Patterns:   ${counts.patterns} discovered
   ${getBar(counts.generated, 50)} Generated:  ${counts.generated} artifacts

${'─'.repeat(60)}
   🔌 Integrations
${'─'.repeat(60)}
`);

  // Check integrations
  const integrations = [
    { name: 'Cursor', file: 'integrations/cursor.json' },
    { name: 'Claude Code', file: 'integrations/claude-code.md' },
    { name: 'GitHub Actions', file: 'integrations/github-actions.yaml' },
  ];

  for (const integration of integrations) {
    const exists = await fs.pathExists(path.join(omgbuildDir, integration.file));
    console.log(`   ${exists ? '✅' : '❌'} ${integration.name.padEnd(20)} ${exists ? 'Configured' : 'Not configured'}`);
  }

  console.log(`
${'─'.repeat(60)}
   💡 Suggestions
${'─'.repeat(60)}
`);

  // Provide suggestions
  const suggestions = [];
  
  if (counts.decisions === 0) {
    suggestions.push('Start recording decisions in .omgbuild/memory/decisions/');
  }
  if (counts.skills < 5) {
    suggestions.push('Add more skills: omgbuild skill add <skill>');
  }
  if (counts.generated < 5) {
    suggestions.push('Run workflows to generate artifacts: omgbuild workflow feature');
  }

  if (suggestions.length === 0) {
    console.log('   ✨ Looking great! Keep building!');
  } else {
    suggestions.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s}`);
    });
  }

  console.log(`
${'─'.repeat(60)}
   📚 Quick Commands
${'─'.repeat(60)}

   omgbuild skill list              # List all skills
   omgbuild workflow feature "..."  # Start new feature
   omgbuild agent analyze           # Run analysis agent
`);
}

async function countItems(dirPath: string): Promise<number> {
  if (!await fs.pathExists(dirPath)) {
    return 0;
  }
  
  const items = await fs.readdir(dirPath);
  return items.filter(i => !i.startsWith('.') && i !== '.gitkeep').length;
}

function calculateHealthScore(counts: Record<string, number>): number {
  let score = 0;
  
  // Skills (max 30 points)
  score += Math.min(counts.skills * 6, 30);
  
  // Workflows (max 20 points)
  score += Math.min(counts.workflows * 5, 20);
  
  // Rules (max 20 points)
  score += Math.min(counts.rules * 4, 20);
  
  // Memory (max 20 points)
  score += Math.min((counts.decisions + counts.patterns) * 2, 20);
  
  // Generated artifacts (max 10 points)
  score += Math.min(counts.generated, 10);
  
  return Math.min(score, 100);
}

function getHealthEmoji(score: number): string {
  if (score >= 80) return '🟢 Excellent';
  if (score >= 60) return '🟡 Good';
  if (score >= 40) return '🟠 Fair';
  return '🔴 Needs attention';
}

function getBar(value: number, max: number): string {
  const filled = Math.min(Math.floor((value / max) * 10), 10);
  const empty = 10 - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}
