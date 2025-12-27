/**
 * 🔮 OMGBUILD Registry Command
 * Manage artifact registries and publish/pull artifacts
 */

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { 
  createRegistryClient, 
  createArtifactPackager,
  ArtifactType,
  RegistryType,
} from '../core/registry';

// ============================================================================
// REGISTRY COMMAND
// ============================================================================

export const registryCommand = new Command('registry')
  .alias('reg')
  .description('Manage artifact registries')
  .action(async () => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    if (!await fs.pathExists(omgbuildDir)) {
      console.log('❌ No OMGBUILD project. Run: omgbuild init');
      return;
    }

    const client = await createRegistryClient(omgbuildDir);
    const registries = client.getRegistries();

    console.log(`
🔮 OMGBUILD Registry
${'═'.repeat(60)}

📦 Configured Registries:
`);

    if (registries.length === 0) {
      console.log('   No registries configured.');
    } else {
      for (const reg of registries) {
        const status = reg.enabled ? '✅' : '❌';
        console.log(`   ${status} ${reg.name} (${reg.type})`);
        console.log(`      URL: ${reg.url}`);
        console.log(`      Priority: ${reg.priority}`);
      }
    }

    console.log(`
Commands:
   omgbuild registry pull <artifact>    Pull artifact from registry
   omgbuild registry push <path>        Push artifact to registry
   omgbuild registry search <query>     Search for artifacts
   omgbuild registry list               List installed artifacts
   omgbuild registry add <name> <url>   Add registry source
   omgbuild registry sync               Sync all artifacts
   omgbuild registry create             Create new artifact

Examples:
   omgbuild registry pull skill/code-review
   omgbuild registry push ./.omgbuild/skills/my-skill
   omgbuild registry search "testing"
   omgbuild registry add github https://github.com/org/omgbuild-registry --git
`);
  });

// ============================================================================
// PULL COMMAND
// ============================================================================

registryCommand
  .command('pull <artifact>')
  .description('Pull an artifact from registry')
  .option('-v, --version <version>', 'Specific version')
  .option('-f, --force', 'Force reinstall')
  .option('--dry-run', 'Show what would be pulled')
  .action(async (
    artifact: string,
    options: { version?: string; force?: boolean; dryRun?: boolean }
  ) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    const client = await createRegistryClient(omgbuildDir);

    console.log(`📥 Pulling: ${artifact}${options.version ? `@${options.version}` : ''}\n`);

    const result = await client.pull(artifact, {
      version: options.version,
      force: options.force,
      dryRun: options.dryRun,
    });

    if (result.success) {
      console.log(`✅ ${result.message}`);
      if (result.artifact) {
        console.log(`   Version: ${result.artifact.version}`);
        console.log(`   Type: ${result.artifact.type}`);
        if (result.path) {
          console.log(`   Path: ${result.path}`);
        }
      }
    } else {
      console.log(`❌ ${result.message}`);
    }
  });

// ============================================================================
// PUSH COMMAND
// ============================================================================

registryCommand
  .command('push <path>')
  .description('Push an artifact to registry')
  .option('-r, --registry <name>', 'Target registry')
  .option('-m, --message <msg>', 'Commit message (for git registries)')
  .option('-t, --tags <tags...>', 'Tags for the artifact')
  .option('--public', 'Make artifact public')
  .action(async (
    artifactPath: string,
    options: { registry?: string; message?: string; tags?: string[]; public?: boolean }
  ) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    // Resolve path
    const fullPath = path.isAbsolute(artifactPath) 
      ? artifactPath 
      : path.join(process.cwd(), artifactPath);

    if (!await fs.pathExists(fullPath)) {
      console.log(`❌ Path not found: ${artifactPath}`);
      return;
    }

    // Validate first
    const packager = createArtifactPackager(omgbuildDir);
    const validation = await packager.validate(fullPath);

    if (!validation.valid) {
      console.log('❌ Validation failed:');
      validation.errors.forEach(e => console.log(`   - ${e}`));
      return;
    }

    if (validation.warnings.length > 0) {
      console.log('⚠️ Warnings:');
      validation.warnings.forEach(w => console.log(`   - ${w}`));
      console.log();
    }

    // Package
    console.log('📦 Packaging artifact...');
    const packageResult = await packager.package(fullPath);

    if (!packageResult.success) {
      console.log(`❌ ${packageResult.message}`);
      return;
    }

    // Push
    console.log('📤 Pushing to registry...');
    const client = await createRegistryClient(omgbuildDir);
    const pushResult = await client.push(fullPath, options.registry, {
      message: options.message,
      tags: options.tags,
      public: options.public,
    });

    if (pushResult.success) {
      console.log(`✅ ${pushResult.message}`);
      if (pushResult.url) {
        console.log(`   URL: ${pushResult.url}`);
      }
    } else {
      console.log(`❌ ${pushResult.message}`);
    }
  });

// ============================================================================
// SEARCH COMMAND
// ============================================================================

registryCommand
  .command('search <query>')
  .description('Search for artifacts')
  .option('-t, --type <type>', 'Filter by type')
  .option('--tags <tags...>', 'Filter by tags')
  .option('-a, --author <author>', 'Filter by author')
  .action(async (
    query: string,
    options: { type?: ArtifactType; tags?: string[]; author?: string }
  ) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    const client = await createRegistryClient(omgbuildDir);

    console.log(`🔍 Searching: "${query}"\n`);

    const results = await client.search(query, {
      type: options.type,
      tags: options.tags,
      author: options.author,
    });

    if (results.length === 0) {
      console.log('No artifacts found.');
      return;
    }

    console.log(`Found ${results.length} artifacts:\n`);

    const typeEmoji: Record<string, string> = {
      skill: '🎯',
      workflow: '🔄',
      pipeline: '📊',
      template: '📁',
      agent: '🤖',
      plugin: '🔌',
    };

    for (const result of results) {
      console.log(`${typeEmoji[result.type] || '📦'} ${result.name}@${result.version}`);
      console.log(`   ${result.description}`);
      console.log(`   Type: ${result.type} | Registry: ${result.registry}`);
      if (result.author) {
        console.log(`   Author: ${result.author}`);
      }
      console.log();
    }

    console.log(`To install: omgbuild registry pull <type>/<name>`);
  });

// ============================================================================
// LIST COMMAND
// ============================================================================

registryCommand
  .command('list')
  .alias('ls')
  .description('List installed artifacts')
  .option('-t, --type <type>', 'Filter by type')
  .action(async (options: { type?: ArtifactType }) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    const client = await createRegistryClient(omgbuildDir);

    const installed = await client.listInstalled(options.type);

    console.log(`
🔮 Installed Artifacts
${'═'.repeat(60)}
`);

    if (installed.length === 0) {
      console.log('No artifacts installed.');
      console.log('\nSearch and install with:');
      console.log('   omgbuild registry search <query>');
      console.log('   omgbuild registry pull <artifact>');
      return;
    }

    // Group by type
    const byType: Record<string, typeof installed> = {};
    for (const artifact of installed) {
      if (!byType[artifact.type]) {
        byType[artifact.type] = [];
      }
      byType[artifact.type].push(artifact);
    }

    const typeEmoji: Record<string, string> = {
      skill: '🎯',
      workflow: '🔄',
      pipeline: '📊',
      template: '📁',
      agent: '🤖',
      plugin: '🔌',
    };

    for (const [type, artifacts] of Object.entries(byType)) {
      console.log(`${typeEmoji[type] || '📦'} ${type.toUpperCase()}S (${artifacts.length})`);
      for (const artifact of artifacts) {
        console.log(`   ${artifact.name}@${artifact.version}`);
        console.log(`      ${artifact.description}`);
      }
      console.log();
    }
  });

// ============================================================================
// ADD REGISTRY COMMAND
// ============================================================================

registryCommand
  .command('add <name> <url>')
  .description('Add a registry source')
  .option('--git', 'Git repository')
  .option('--local', 'Local directory')
  .option('--remote', 'Remote API')
  .option('-b, --branch <branch>', 'Git branch', 'main')
  .option('--token <token>', 'Authentication token')
  .action(async (
    name: string,
    url: string,
    options: { git?: boolean; local?: boolean; remote?: boolean; branch?: string; token?: string }
  ) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    const client = await createRegistryClient(omgbuildDir);

    let type: RegistryType = 'local';
    if (options.git) type = 'git';
    else if (options.remote) type = 'remote';
    else if (url.startsWith('http')) type = url.includes('github') || url.includes('gitlab') ? 'git' : 'remote';

    await client.addRegistry({
      name,
      type,
      url,
      branch: options.branch,
      token: options.token,
      enabled: true,
    });

    console.log(`✅ Added registry: ${name}`);
    console.log(`   Type: ${type}`);
    console.log(`   URL: ${url}`);
  });

// ============================================================================
// REMOVE REGISTRY COMMAND
// ============================================================================

registryCommand
  .command('remove <name>')
  .alias('rm')
  .description('Remove a registry source')
  .action(async (name: string) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    const client = await createRegistryClient(omgbuildDir);

    const removed = await client.removeRegistry(name);
    
    if (removed) {
      console.log(`✅ Removed registry: ${name}`);
    } else {
      console.log(`❌ Registry not found: ${name}`);
    }
  });

// ============================================================================
// SYNC COMMAND
// ============================================================================

registryCommand
  .command('sync')
  .description('Sync artifacts from registries')
  .option('-t, --type <type>', 'Sync specific type')
  .option('-f, --force', 'Force update all')
  .action(async (options: { type?: ArtifactType; force?: boolean }) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    const client = await createRegistryClient(omgbuildDir);

    console.log('🔄 Syncing from registries...\n');

    // Refresh index first
    await client.refreshIndex();

    const result = await client.sync({
      type: options.type,
      force: options.force,
    });

    console.log(`
📊 Sync Complete:
   ✅ Pulled: ${result.pulled.length}
   ⏭️ Skipped: ${result.skipped.length}
   ❌ Failed: ${result.failed.length}
`);

    if (result.pulled.length > 0) {
      console.log('Pulled:');
      result.pulled.forEach(a => console.log(`   + ${a}`));
    }

    if (result.failed.length > 0) {
      console.log('\nFailed:');
      result.failed.forEach(a => console.log(`   ✗ ${a}`));
    }
  });

// ============================================================================
// UPDATE COMMAND
// ============================================================================

registryCommand
  .command('update')
  .description('Check for artifact updates')
  .option('-u, --upgrade', 'Upgrade all outdated')
  .action(async (options: { upgrade?: boolean }) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    const client = await createRegistryClient(omgbuildDir);

    console.log('🔍 Checking for updates...\n');

    await client.refreshIndex();
    const updates = await client.checkUpdates();

    if (updates.length === 0) {
      console.log('✅ All artifacts are up to date!');
      return;
    }

    console.log(`Found ${updates.length} updates:\n`);

    for (const update of updates) {
      console.log(`📦 ${update.name}`);
      console.log(`   ${update.installed} → ${update.available}`);
      console.log(`   Registry: ${update.registry}`);
      console.log();
    }

    if (options.upgrade) {
      console.log('Upgrading...\n');
      for (const update of updates) {
        const result = await client.pull(`${update.type}/${update.name}`, { force: true });
        if (result.success) {
          console.log(`✅ ${update.name}@${update.available}`);
        } else {
          console.log(`❌ ${update.name}: ${result.message}`);
        }
      }
    } else {
      console.log('Run with --upgrade to install updates');
    }
  });

// ============================================================================
// CREATE COMMAND
// ============================================================================

registryCommand
  .command('create <type> <name>')
  .description('Create a new artifact')
  .option('-d, --description <desc>', 'Artifact description')
  .option('-a, --author <author>', 'Author name')
  .action(async (
    type: ArtifactType,
    name: string,
    options: { description?: string; author?: string }
  ) => {
    const validTypes: ArtifactType[] = ['skill', 'workflow', 'pipeline', 'template', 'agent', 'plugin'];
    
    if (!validTypes.includes(type)) {
      console.log(`❌ Invalid type: ${type}`);
      console.log(`Valid types: ${validTypes.join(', ')}`);
      return;
    }

    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    const packager = createArtifactPackager(omgbuildDir);

    const result = await packager.create(type, name, {
      description: options.description,
      author: options.author,
    });

    if (result.success) {
      console.log(`✅ ${result.message}`);
      console.log(`   Path: ${result.path}`);
      console.log(`
Next steps:
   1. Edit files in ${result.path}
   2. Validate: omgbuild registry validate ${result.path}
   3. Publish: omgbuild registry push ${result.path}
`);
    } else {
      console.log(`❌ ${result.message}`);
    }
  });

// ============================================================================
// VALIDATE COMMAND
// ============================================================================

registryCommand
  .command('validate <path>')
  .description('Validate an artifact')
  .action(async (artifactPath: string) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    const packager = createArtifactPackager(omgbuildDir);

    const fullPath = path.isAbsolute(artifactPath)
      ? artifactPath
      : path.join(process.cwd(), artifactPath);

    console.log(`🔍 Validating: ${artifactPath}\n`);

    const result = await packager.validate(fullPath);

    if (result.valid) {
      console.log('✅ Artifact is valid!');
    } else {
      console.log('❌ Validation failed:');
      result.errors.forEach(e => console.log(`   ✗ ${e}`));
    }

    if (result.warnings.length > 0) {
      console.log('\n⚠️ Warnings:');
      result.warnings.forEach(w => console.log(`   - ${w}`));
    }
  });

// ============================================================================
// BUMP VERSION COMMAND
// ============================================================================

registryCommand
  .command('bump <path> [type]')
  .description('Bump artifact version')
  .action(async (artifactPath: string, type?: 'major' | 'minor' | 'patch') => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    const packager = createArtifactPackager(omgbuildDir);

    const fullPath = path.isAbsolute(artifactPath)
      ? artifactPath
      : path.join(process.cwd(), artifactPath);

    const newVersion = await packager.bumpVersion(fullPath, type || 'patch');
    console.log(`✅ Version bumped to: ${newVersion}`);
  });
