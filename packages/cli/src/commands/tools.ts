/**
 * 🔮 OMGBUILD Tools Command
 * Discover and manage AI tools
 */

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';
import { discoverTools, createDefaultRegistry, DEFAULT_CAPABILITIES, ToolType } from '../core/adapters';

// ============================================================================
// TOOLS COMMAND
// ============================================================================

export const toolsCommand = new Command('tools')
  .description('Discover and manage AI tools')
  .action(async () => {
    console.log(`
🔮 OMGBUILD Tool Management

Commands:
  omgbuild tools discover     Discover available AI tools
  omgbuild tools list         List configured tools
  omgbuild tools info <tool>  Show tool details
  omgbuild tools config       Show/edit tool configuration
  omgbuild tools test <tool>  Test a tool

Examples:
  omgbuild tools discover     # Find what's installed
  omgbuild tools info claude-code
  omgbuild tools test codex
`);
  });

// ============================================================================
// DISCOVER COMMAND
// ============================================================================

toolsCommand
  .command('discover')
  .alias('scan')
  .description('Discover available AI tools on your system')
  .action(async () => {
    console.log(`
🔍 Discovering AI Tools
${'═'.repeat(50)}

Scanning for installed tools...
`);

    const { available, unavailable } = await discoverTools();

    if (available.length > 0) {
      console.log('✅ Available Tools:\n');
      for (const tool of available) {
        const version = tool.version ? `v${tool.version}` : '';
        console.log(`   ${tool.name.padEnd(15)} ${version.padEnd(10)} Ready`);
      }
    }

    if (unavailable.length > 0) {
      console.log('\n❌ Not Installed:\n');
      for (const tool of unavailable) {
        console.log(`   ${tool.name.padEnd(15)}`);
        console.log(`      Install: ${tool.installHint}`);
      }
    }

    console.log(`
${'─'.repeat(50)}
Summary: ${available.length} available, ${unavailable.length} not installed

Tip: Install more tools for better task routing!
`);
  });

// ============================================================================
// LIST COMMAND
// ============================================================================

toolsCommand
  .command('list')
  .alias('ls')
  .description('List configured tools')
  .action(async () => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    const configPath = path.join(omgbuildDir, 'tools.yaml');

    console.log(`
🔧 Configured Tools
${'═'.repeat(50)}
`);

    // Check for custom config
    if (await fs.pathExists(configPath)) {
      const content = await fs.readFile(configPath, 'utf-8');
      const config = yaml.load(content) as Record<string, unknown>;
      console.log('📁 Custom configuration found:\n');
      console.log(yaml.dump(config));
    } else {
      console.log('📁 Using default tool configuration\n');
    }

    // Show default tools
    const registry = await createDefaultRegistry();
    const tools = registry.getAll();

    console.log('Tools in registry:\n');
    
    const headers = ['Name', 'Type', 'Priority', 'Preferred For'].map(h => h.padEnd(15)).join('');
    console.log(headers);
    console.log('─'.repeat(60));

    for (const tool of tools) {
      const config = (tool as any).config;
      const preferFor = config?.routing?.preferFor?.join(', ') || 'general';
      const priority = config?.routing?.priority || 50;
      
      console.log(
        `${tool.name.padEnd(15)}` +
        `${tool.type.padEnd(15)}` +
        `${priority.toString().padEnd(15)}` +
        `${preferFor}`
      );
    }

    console.log(`
${'─'.repeat(50)}

Customize routing in: .omgbuild/tools.yaml
`);
  });

// ============================================================================
// INFO COMMAND
// ============================================================================

toolsCommand
  .command('info <tool>')
  .description('Show detailed tool information')
  .action(async (toolName: string) => {
    const registry = await createDefaultRegistry();
    const tool = registry.get(toolName);

    if (!tool) {
      console.error(`❌ Tool not found: ${toolName}`);
      console.log(`\nAvailable tools: ${registry.getAll().map(t => t.name).join(', ')}`);
      process.exit(1);
    }

    const isAvailable = await tool.checkAvailability();
    const version = await tool.getVersion();
    const capabilities = tool.capabilities;

    console.log(`
🔧 Tool: ${tool.name}
${'═'.repeat(50)}

Type:      ${tool.type}
Status:    ${isAvailable ? '✅ Available' : '❌ Not available'}
Version:   ${version || 'Unknown'}

📋 Capabilities:
   Can Code:          ${capabilities.canCode ? '✅' : '❌'}
   Can Chat:          ${capabilities.canChat ? '✅' : '❌'}
   Can Edit Files:    ${capabilities.canEdit ? '✅' : '❌'}
   Can Execute Shell: ${capabilities.canExecuteShell ? '✅' : '❌'}
   Can Read Files:    ${capabilities.canReadFiles ? '✅' : '❌'}
   Can Write Files:   ${capabilities.canWriteFiles ? '✅' : '❌'}
   Can Search:        ${capabilities.canSearch ? '✅' : '❌'}
   Can Browse Web:    ${capabilities.canBrowseWeb ? '✅' : '❌'}
   Supports Streaming: ${capabilities.supportsStreaming ? '✅' : '❌'}
   Multi-file Support: ${capabilities.supportsMultiFile ? '✅' : '❌'}
   Project Support:    ${capabilities.supportsProject ? '✅' : '❌'}

🎯 Task Routing:
   Best for: ${(tool as any).config?.routing?.preferFor?.join(', ') || 'general tasks'}
   Avoid for: ${(tool as any).config?.routing?.avoidFor?.join(', ') || 'none'}
   Priority: ${(tool as any).config?.routing?.priority || 50}

Usage:
   omgbuild exec "your task" --tool ${tool.name}
`);
  });

// ============================================================================
// CONFIG COMMAND
// ============================================================================

toolsCommand
  .command('config')
  .description('Show or create tool configuration')
  .option('--init', 'Create default configuration file')
  .action(async (options: { init?: boolean }) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    const configPath = path.join(omgbuildDir, 'tools.yaml');

    if (options.init) {
      if (!await fs.pathExists(omgbuildDir)) {
        console.error('❌ No .omgbuild directory. Run `omgbuild init` first.');
        process.exit(1);
      }

      const defaultConfig = {
        version: '1.0',
        default_tool: 'auto',
        
        routing: {
          code: ['claude-code', 'codex', 'aider'],
          analyze: ['claude-code', 'gemini'],
          test: ['claude-code', 'codex'],
          review: ['claude-code', 'gemini'],
          refactor: ['aider', 'claude-code'],
          debug: ['claude-code', 'codex'],
          document: ['gemini', 'claude-code'],
        },

        tools: {
          'claude-code': {
            enabled: true,
            priority: 90,
            timeout: 300000,
            preferFor: ['code', 'analyze', 'debug'],
          },
          'codex': {
            enabled: true,
            priority: 80,
            timeout: 300000,
            preferFor: ['code', 'test'],
          },
          'gemini': {
            enabled: true,
            priority: 75,
            timeout: 300000,
            preferFor: ['analyze', 'document'],
          },
          'aider': {
            enabled: true,
            priority: 70,
            timeout: 600000,
            preferFor: ['refactor', 'code'],
          },
        },

        fallback: {
          enabled: true,
          chain: ['claude-code', 'codex', 'gemini', 'aider'],
        },
      };

      await fs.writeFile(configPath, yaml.dump(defaultConfig), 'utf-8');

      console.log(`
✅ Tool configuration created: ${configPath}

Edit this file to customize:
- Tool priorities
- Task routing
- Timeouts
- Fallback chains
`);
    } else {
      if (await fs.pathExists(configPath)) {
        const content = await fs.readFile(configPath, 'utf-8');
        console.log(`
📄 Tool Configuration: ${configPath}
${'═'.repeat(50)}

${content}
`);
      } else {
        console.log(`
📄 Tool Configuration
${'═'.repeat(50)}

No custom configuration found.
Using default tool settings.

Create one with:
   omgbuild tools config --init
`);
      }
    }
  });

// ============================================================================
// TEST COMMAND
// ============================================================================

toolsCommand
  .command('test <tool>')
  .description('Test a tool with a simple task')
  .action(async (toolName: string) => {
    const registry = await createDefaultRegistry();
    const tool = registry.get(toolName);

    if (!tool) {
      console.error(`❌ Tool not found: ${toolName}`);
      process.exit(1);
    }

    console.log(`
🧪 Testing: ${tool.name}
${'═'.repeat(50)}

Checking availability...`);

    const isAvailable = await tool.checkAvailability();
    
    if (!isAvailable) {
      console.log(`\n❌ Tool is not available.`);
      process.exit(1);
    }

    const version = await tool.getVersion();
    console.log(`✅ Available (${version || 'version unknown'})`);

    console.log(`\nRunning test task...`);
    console.log('─'.repeat(50));

    try {
      const result = await tool.execute(
        {
          task: 'Say "Hello from OMGBUILD!" and nothing else.',
          taskType: 'chat',
          projectRoot: process.cwd(),
          omgbuildDir: path.join(process.cwd(), '.omgbuild'),
        },
        {
          onOutput: (chunk) => {
            process.stdout.write(chunk);
          },
        }
      );

      console.log('\n' + '─'.repeat(50));

      if (result.success) {
        console.log(`\n✅ Test passed! (${formatDuration(result.duration)})`);
      } else {
        console.log(`\n❌ Test failed: ${result.error}`);
        process.exit(1);
      }
    } catch (error) {
      console.log('\n' + '─'.repeat(50));
      console.error(`\n❌ Test error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// ============================================================================
// HELPERS
// ============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}
