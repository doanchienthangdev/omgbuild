/**
 * 🔮 OMGBUILD Plugin System
 * Extensible architecture for custom plugins
 */

import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';

// ============================================================================
// TYPES
// ============================================================================

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  main: string;
  hooks: PluginHook[];
  commands?: PluginCommand[];
  settings?: PluginSetting[];
  dependencies?: Record<string, string>;
}

export interface PluginHook {
  event: PluginEvent;
  handler: string;
  priority?: number;
}

export type PluginEvent = 
  | 'pre-init'
  | 'post-init'
  | 'pre-skill'
  | 'post-skill'
  | 'pre-workflow'
  | 'post-workflow'
  | 'pre-build'
  | 'post-build'
  | 'pre-deploy'
  | 'post-deploy'
  | 'on-error'
  | 'on-memory-save'
  | 'on-analytics';

export interface PluginCommand {
  name: string;
  description: string;
  handler: string;
  options?: PluginCommandOption[];
}

export interface PluginCommandOption {
  name: string;
  alias?: string;
  description: string;
  type: 'string' | 'boolean' | 'number';
  required?: boolean;
  default?: unknown;
}

export interface PluginSetting {
  name: string;
  description: string;
  type: 'string' | 'boolean' | 'number' | 'array' | 'object';
  default?: unknown;
  required?: boolean;
}

export interface PluginContext {
  omgbuildDir: string;
  projectRoot: string;
  config: Record<string, unknown>;
  memory: {
    getDecisions: () => Promise<unknown[]>;
    saveDecision: (decision: unknown) => Promise<void>;
  };
  analytics: {
    recordEvent: (event: unknown) => Promise<void>;
  };
  logger: PluginLogger;
}

export interface PluginLogger {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  debug: (message: string) => void;
}

export interface LoadedPlugin {
  manifest: PluginManifest;
  path: string;
  instance: PluginInstance;
  enabled: boolean;
}

export interface PluginInstance {
  activate?: (context: PluginContext) => Promise<void>;
  deactivate?: () => Promise<void>;
  [key: string]: unknown;
}

// ============================================================================
// PLUGIN MANAGER
// ============================================================================

export class PluginManager {
  private omgbuildDir: string;
  private pluginsDir: string;
  private plugins: Map<string, LoadedPlugin> = new Map();
  private hooks: Map<PluginEvent, Array<{ plugin: string; handler: string; priority: number }>> = new Map();
  private context: PluginContext | null = null;

  constructor(omgbuildDir: string) {
    this.omgbuildDir = omgbuildDir;
    this.pluginsDir = path.join(omgbuildDir, 'plugins');
  }

  /**
   * Initialize plugin manager
   */
  async initialize(context: PluginContext): Promise<void> {
    this.context = context;
    await fs.ensureDir(this.pluginsDir);
    await this.loadPlugins();
  }

  /**
   * Load all plugins from plugins directory
   */
  private async loadPlugins(): Promise<void> {
    if (!await fs.pathExists(this.pluginsDir)) {
      return;
    }

    const dirs = await fs.readdir(this.pluginsDir);
    
    for (const dir of dirs) {
      const pluginPath = path.join(this.pluginsDir, dir);
      const stat = await fs.stat(pluginPath);
      
      if (stat.isDirectory()) {
        try {
          await this.loadPlugin(pluginPath);
        } catch (error) {
          console.warn(`Failed to load plugin ${dir}: ${(error as Error).message}`);
        }
      }
    }
  }

  /**
   * Load a single plugin
   */
  private async loadPlugin(pluginPath: string): Promise<void> {
    const manifestPath = path.join(pluginPath, 'plugin.yaml');
    
    if (!await fs.pathExists(manifestPath)) {
      throw new Error('plugin.yaml not found');
    }

    const content = await fs.readFile(manifestPath, 'utf-8');
    const manifest = yaml.load(content) as PluginManifest;

    // Create plugin instance (in real implementation, would load JS/TS module)
    const instance: PluginInstance = {};

    const loadedPlugin: LoadedPlugin = {
      manifest,
      path: pluginPath,
      instance,
      enabled: true,
    };

    this.plugins.set(manifest.name, loadedPlugin);

    // Register hooks
    for (const hook of manifest.hooks) {
      this.registerHook(manifest.name, hook);
    }

    // Activate plugin
    if (instance.activate && this.context) {
      await instance.activate(this.context);
    }
  }

  /**
   * Register a hook
   */
  private registerHook(pluginName: string, hook: PluginHook): void {
    const handlers = this.hooks.get(hook.event) || [];
    handlers.push({
      plugin: pluginName,
      handler: hook.handler,
      priority: hook.priority || 100,
    });
    
    // Sort by priority (lower = higher priority)
    handlers.sort((a, b) => a.priority - b.priority);
    
    this.hooks.set(hook.event, handlers);
  }

  /**
   * Trigger a hook event
   */
  async trigger(event: PluginEvent, data?: unknown): Promise<unknown[]> {
    const handlers = this.hooks.get(event) || [];
    const results: unknown[] = [];

    for (const { plugin, handler } of handlers) {
      const loadedPlugin = this.plugins.get(plugin);
      if (!loadedPlugin?.enabled) continue;

      try {
        const handlerFn = loadedPlugin.instance[handler];
        if (typeof handlerFn === 'function') {
          const result = await handlerFn.call(loadedPlugin.instance, data, this.context);
          results.push(result);
        }
      } catch (error) {
        console.error(`Plugin ${plugin} hook ${handler} failed: ${(error as Error).message}`);
      }
    }

    return results;
  }

  /**
   * Install a plugin from a directory or URL
   */
  async install(source: string): Promise<void> {
    const pluginName = path.basename(source);
    const targetPath = path.join(this.pluginsDir, pluginName);

    if (await fs.pathExists(targetPath)) {
      throw new Error(`Plugin ${pluginName} already installed`);
    }

    // Copy plugin directory
    if (await fs.pathExists(source)) {
      await fs.copy(source, targetPath);
    } else {
      throw new Error(`Plugin source not found: ${source}`);
    }

    // Load the plugin
    await this.loadPlugin(targetPath);
  }

  /**
   * Uninstall a plugin
   */
  async uninstall(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin not found: ${name}`);
    }

    // Deactivate
    if (plugin.instance.deactivate) {
      await plugin.instance.deactivate();
    }

    // Remove hooks
    for (const [event, handlers] of this.hooks) {
      this.hooks.set(event, handlers.filter(h => h.plugin !== name));
    }

    // Remove plugin
    this.plugins.delete(name);
    await fs.remove(plugin.path);
  }

  /**
   * Enable a plugin
   */
  enable(name: string): void {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin not found: ${name}`);
    }
    plugin.enabled = true;
  }

  /**
   * Disable a plugin
   */
  disable(name: string): void {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin not found: ${name}`);
    }
    plugin.enabled = false;
  }

  /**
   * List all plugins
   */
  list(): LoadedPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugin info
   */
  getPlugin(name: string): LoadedPlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Create a new plugin scaffold
   */
  async scaffold(name: string, options: {
    description?: string;
    hooks?: PluginEvent[];
    commands?: string[];
  } = {}): Promise<string> {
    const pluginPath = path.join(this.pluginsDir, name);

    if (await fs.pathExists(pluginPath)) {
      throw new Error(`Plugin ${name} already exists`);
    }

    await fs.ensureDir(pluginPath);

    // Create manifest
    const manifest: PluginManifest = {
      name,
      version: '1.0.0',
      description: options.description || `${name} plugin for OMGBUILD`,
      author: 'Your Name',
      license: 'MIT',
      main: 'index.ts',
      hooks: (options.hooks || ['post-init']).map(event => ({
        event,
        handler: `on${event.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')}`,
      })),
      commands: options.commands?.map(cmd => ({
        name: cmd,
        description: `${cmd} command`,
        handler: `${cmd}Handler`,
      })),
      settings: [],
    };

    await fs.writeFile(
      path.join(pluginPath, 'plugin.yaml'),
      yaml.dump(manifest),
      'utf-8'
    );

    // Create main file
    const mainContent = `/**
 * ${name} - OMGBUILD Plugin
 * ${manifest.description}
 */

import { PluginContext } from 'omgbuild';

export async function activate(context: PluginContext): Promise<void> {
  context.logger.info('${name} plugin activated');
}

export async function deactivate(): Promise<void> {
  // Cleanup
}

${manifest.hooks.map(hook => `
export async function ${hook.handler}(data: unknown, context: PluginContext): Promise<void> {
  // Handle ${hook.event} event
  context.logger.debug('${hook.event} triggered');
}
`).join('\n')}

${(manifest.commands || []).map(cmd => `
export async function ${cmd.handler}(args: unknown, context: PluginContext): Promise<void> {
  // Handle ${cmd.name} command
  context.logger.info('Running ${cmd.name}');
}
`).join('\n')}
`;

    await fs.writeFile(
      path.join(pluginPath, 'index.ts'),
      mainContent,
      'utf-8'
    );

    // Create README
    const readmeContent = `# ${name}

${manifest.description}

## Installation

\`\`\`bash
omgbuild plugin install ./${name}
\`\`\`

## Usage

This plugin hooks into:
${manifest.hooks.map(h => `- \`${h.event}\``).join('\n')}

${manifest.commands?.length ? `
## Commands

${manifest.commands.map(c => `- \`omgbuild ${c.name}\` - ${c.description}`).join('\n')}
` : ''}

## Configuration

Add to your \`.omgbuild/config.yaml\`:

\`\`\`yaml
plugins:
  ${name}:
    enabled: true
\`\`\`

## License

${manifest.license}
`;

    await fs.writeFile(
      path.join(pluginPath, 'README.md'),
      readmeContent,
      'utf-8'
    );

    return pluginPath;
  }
}

// ============================================================================
// BUILT-IN PLUGIN TEMPLATES
// ============================================================================

export const PLUGIN_TEMPLATES = {
  'slack-notify': {
    name: 'slack-notify',
    description: 'Send notifications to Slack on workflow events',
    hooks: ['post-workflow', 'on-error'] as PluginEvent[],
    settings: [
      { name: 'webhook_url', type: 'string' as const, required: true },
      { name: 'channel', type: 'string' as const, default: '#dev' },
    ],
  },
  'jira-integration': {
    name: 'jira-integration',
    description: 'Sync tasks and decisions with Jira',
    hooks: ['post-workflow', 'on-memory-save'] as PluginEvent[],
    commands: ['jira-sync', 'jira-create'],
  },
  'metrics-dashboard': {
    name: 'metrics-dashboard',
    description: 'Serve a local dashboard for analytics',
    hooks: ['on-analytics'] as PluginEvent[],
    commands: ['dashboard'],
  },
  'git-hooks': {
    name: 'git-hooks',
    description: 'Install git hooks for pre-commit checks',
    hooks: ['post-init'] as PluginEvent[],
    commands: ['hooks-install', 'hooks-uninstall'],
  },
  'code-standards': {
    name: 'code-standards',
    description: 'Enforce custom code standards',
    hooks: ['pre-skill', 'post-skill'] as PluginEvent[],
  },
};

// ============================================================================
// FACTORY
// ============================================================================

export async function createPluginManager(
  omgbuildDir: string,
  context: PluginContext
): Promise<PluginManager> {
  const manager = new PluginManager(omgbuildDir);
  await manager.initialize(context);
  return manager;
}
