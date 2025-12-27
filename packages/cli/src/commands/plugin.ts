/**
 * 🔮 OMGBUILD Plugin Command
 * Manage plugins for extensibility
 */

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { PluginManager, PLUGIN_TEMPLATES, PluginEvent } from '../core/plugin-system';

// ============================================================================
// PLUGIN COMMAND
// ============================================================================

export const pluginCommand = new Command('plugin')
  .description('Manage OMGBUILD plugins')
  .action(() => {
    console.log(`
🔮 OMGBUILD Plugin System

Commands:
  omgbuild plugin list                 List installed plugins
  omgbuild plugin install <source>     Install a plugin
  omgbuild plugin uninstall <name>     Uninstall a plugin
  omgbuild plugin enable <name>        Enable a plugin
  omgbuild plugin disable <name>       Disable a plugin
  omgbuild plugin create <name>        Create a new plugin scaffold
  omgbuild plugin templates            Show available plugin templates

Examples:
  omgbuild plugin list
  omgbuild plugin create my-plugin
  omgbuild plugin create my-notifier --template slack-notify
  omgbuild plugin install ./my-plugin
`);
  });

// ============================================================================
// LIST COMMAND
// ============================================================================

pluginCommand
  .command('list')
  .alias('ls')
  .description('List installed plugins')
  .action(async () => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    if (!await fs.pathExists(omgbuildDir)) {
      console.error('❌ No .omgbuild directory found. Run `omgbuild init` first.');
      process.exit(1);
    }

    // Create a minimal context for plugin manager
    const context = createMinimalContext(omgbuildDir);
    const manager = new PluginManager(omgbuildDir);
    await manager.initialize(context);

    const plugins = manager.list();

    console.log(`
🔌 Installed Plugins
${'═'.repeat(50)}
`);

    if (plugins.length === 0) {
      console.log('   No plugins installed yet.\n');
      console.log('   Create one with: omgbuild plugin create my-plugin');
      console.log('   Or see templates: omgbuild plugin templates\n');
    } else {
      for (const plugin of plugins) {
        const status = plugin.enabled ? '✅' : '❌';
        console.log(`${status} ${plugin.manifest.name} v${plugin.manifest.version}`);
        console.log(`   ${plugin.manifest.description}`);
        console.log(`   Hooks: ${plugin.manifest.hooks.map(h => h.event).join(', ')}`);
        if (plugin.manifest.commands?.length) {
          console.log(`   Commands: ${plugin.manifest.commands.map(c => c.name).join(', ')}`);
        }
        console.log();
      }
    }
  });

// ============================================================================
// INSTALL COMMAND
// ============================================================================

pluginCommand
  .command('install <source>')
  .alias('i')
  .description('Install a plugin from a directory')
  .action(async (source: string) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    if (!await fs.pathExists(omgbuildDir)) {
      console.error('❌ No .omgbuild directory found. Run `omgbuild init` first.');
      process.exit(1);
    }

    const context = createMinimalContext(omgbuildDir);
    const manager = new PluginManager(omgbuildDir);
    await manager.initialize(context);

    console.log(`\n📥 Installing plugin from: ${source}...\n`);

    try {
      await manager.install(source);
      const name = path.basename(source);
      console.log(`✅ Successfully installed plugin: ${name}`);
      console.log(`\n   The plugin is now active and will respond to configured hooks.`);
    } catch (error) {
      console.error(`\n❌ Failed to install: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// ============================================================================
// UNINSTALL COMMAND
// ============================================================================

pluginCommand
  .command('uninstall <name>')
  .alias('rm')
  .description('Uninstall a plugin')
  .action(async (name: string) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    if (!await fs.pathExists(omgbuildDir)) {
      console.error('❌ No .omgbuild directory found.');
      process.exit(1);
    }

    const context = createMinimalContext(omgbuildDir);
    const manager = new PluginManager(omgbuildDir);
    await manager.initialize(context);

    console.log(`\n🗑️ Uninstalling plugin: ${name}...\n`);

    try {
      await manager.uninstall(name);
      console.log(`✅ Successfully uninstalled plugin: ${name}`);
    } catch (error) {
      console.error(`\n❌ Failed to uninstall: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// ============================================================================
// ENABLE COMMAND
// ============================================================================

pluginCommand
  .command('enable <name>')
  .description('Enable a plugin')
  .action(async (name: string) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    if (!await fs.pathExists(omgbuildDir)) {
      console.error('❌ No .omgbuild directory found.');
      process.exit(1);
    }

    const context = createMinimalContext(omgbuildDir);
    const manager = new PluginManager(omgbuildDir);
    await manager.initialize(context);

    try {
      manager.enable(name);
      console.log(`\n✅ Plugin ${name} enabled.\n`);
    } catch (error) {
      console.error(`\n❌ ${(error as Error).message}`);
      process.exit(1);
    }
  });

// ============================================================================
// DISABLE COMMAND
// ============================================================================

pluginCommand
  .command('disable <name>')
  .description('Disable a plugin')
  .action(async (name: string) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    if (!await fs.pathExists(omgbuildDir)) {
      console.error('❌ No .omgbuild directory found.');
      process.exit(1);
    }

    const context = createMinimalContext(omgbuildDir);
    const manager = new PluginManager(omgbuildDir);
    await manager.initialize(context);

    try {
      manager.disable(name);
      console.log(`\n✅ Plugin ${name} disabled.\n`);
    } catch (error) {
      console.error(`\n❌ ${(error as Error).message}`);
      process.exit(1);
    }
  });

// ============================================================================
// CREATE COMMAND
// ============================================================================

pluginCommand
  .command('create <name>')
  .description('Create a new plugin scaffold')
  .option('-t, --template <template>', 'Use a template')
  .option('--hooks <hooks>', 'Comma-separated list of hooks')
  .option('--commands <commands>', 'Comma-separated list of commands')
  .option('-d, --description <desc>', 'Plugin description')
  .action(async (
    name: string,
    options: {
      template?: string;
      hooks?: string;
      commands?: string;
      description?: string;
    }
  ) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    if (!await fs.pathExists(omgbuildDir)) {
      console.error('❌ No .omgbuild directory found. Run `omgbuild init` first.');
      process.exit(1);
    }

    const context = createMinimalContext(omgbuildDir);
    const manager = new PluginManager(omgbuildDir);
    await manager.initialize(context);

    console.log(`\n🔧 Creating plugin: ${name}...\n`);

    try {
      let scaffoldOptions: {
        description?: string;
        hooks?: PluginEvent[];
        commands?: string[];
      } = {
        description: options.description,
      };

      // Use template if specified
      if (options.template) {
        const template = PLUGIN_TEMPLATES[options.template as keyof typeof PLUGIN_TEMPLATES];
        if (!template) {
          console.error(`❌ Template not found: ${options.template}`);
          console.log(`\nAvailable templates: ${Object.keys(PLUGIN_TEMPLATES).join(', ')}`);
          process.exit(1);
        }
        scaffoldOptions = {
          description: template.description,
          hooks: template.hooks,
          commands: (template as any).commands,
        };
      }

      // Override with CLI options
      if (options.hooks) {
        scaffoldOptions.hooks = options.hooks.split(',').map(h => h.trim() as PluginEvent);
      }
      if (options.commands) {
        scaffoldOptions.commands = options.commands.split(',').map(c => c.trim());
      }

      const pluginPath = await manager.scaffold(name, scaffoldOptions);

      console.log(`✅ Plugin created: ${path.relative(process.cwd(), pluginPath)}`);
      console.log(`
📁 Plugin Structure:
   ${name}/
   ├── plugin.yaml    # Plugin manifest
   ├── index.ts       # Main plugin code
   └── README.md      # Documentation

📋 Next Steps:
   1. Edit ${name}/index.ts to implement your logic
   2. Test locally: omgbuild plugin install .omgbuild/plugins/${name}
   3. Share with your team!

💡 Available Hooks:
   pre-init, post-init, pre-skill, post-skill,
   pre-workflow, post-workflow, pre-build, post-build,
   pre-deploy, post-deploy, on-error, on-memory-save, on-analytics
`);
    } catch (error) {
      console.error(`\n❌ Failed to create: ${(error as Error).message}`);
      process.exit(1);
    }
  });

// ============================================================================
// TEMPLATES COMMAND
// ============================================================================

pluginCommand
  .command('templates')
  .description('Show available plugin templates')
  .action(() => {
    console.log(`
📦 Available Plugin Templates
${'═'.repeat(60)}
`);

    for (const [name, template] of Object.entries(PLUGIN_TEMPLATES)) {
      console.log(`🔌 ${name}`);
      console.log(`   ${template.description}`);
      console.log(`   Hooks: ${template.hooks.join(', ')}`);
      if ((template as any).commands) {
        console.log(`   Commands: ${(template as any).commands.join(', ')}`);
      }
      console.log();
    }

    console.log(`
Usage:
   omgbuild plugin create my-notifier --template slack-notify
   omgbuild plugin create my-tracker --template jira-integration
`);
  });

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createMinimalContext(omgbuildDir: string) {
  return {
    omgbuildDir,
    projectRoot: path.dirname(omgbuildDir),
    config: {},
    memory: {
      getDecisions: async () => [],
      saveDecision: async () => {},
    },
    analytics: {
      recordEvent: async () => {},
    },
    logger: {
      info: console.log,
      warn: console.warn,
      error: console.error,
      debug: () => {},
    },
  };
}
