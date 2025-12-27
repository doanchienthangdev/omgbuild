/**
 * 🔮 OMGBUILD Phase 6 - Artifact Packager
 * Package local artifacts for publishing to registry
 */

import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';
import archiver from 'archiver';
import { createHash } from 'crypto';
import { ArtifactManifest, ArtifactType } from './registry-client';

// ============================================================================
// TYPES
// ============================================================================

export interface PackageOptions {
  output?: string;
  include?: string[];
  exclude?: string[];
  compress?: boolean;
}

export interface PackageResult {
  success: boolean;
  manifest?: ArtifactManifest;
  packagePath?: string;
  size?: number;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// ARTIFACT PACKAGER
// ============================================================================

export class ArtifactPackager {
  private omgbuildDir: string;

  constructor(omgbuildDir: string) {
    this.omgbuildDir = omgbuildDir;
  }

  /**
   * Create a new artifact from template
   */
  async create(
    type: ArtifactType,
    name: string,
    options?: {
      description?: string;
      author?: string;
      template?: string;
    }
  ): Promise<{
    success: boolean;
    path: string;
    message: string;
  }> {
    const artifactPath = path.join(this.omgbuildDir, `${type}s`, name);

    if (await fs.pathExists(artifactPath)) {
      return {
        success: false,
        path: artifactPath,
        message: `Artifact already exists: ${name}`,
      };
    }

    await fs.ensureDir(artifactPath);

    // Create manifest
    const manifest: ArtifactManifest = {
      name,
      version: '1.0.0',
      type,
      description: options?.description || `A new ${type}`,
      author: options?.author,
      files: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Create type-specific files
    switch (type) {
      case 'skill':
        await this.createSkillTemplate(artifactPath, manifest);
        break;
      case 'workflow':
        await this.createWorkflowTemplate(artifactPath, manifest);
        break;
      case 'pipeline':
        await this.createPipelineTemplate(artifactPath, manifest);
        break;
      case 'template':
        await this.createTemplateTemplate(artifactPath, manifest);
        break;
      case 'agent':
        await this.createAgentTemplate(artifactPath, manifest);
        break;
      case 'plugin':
        await this.createPluginTemplate(artifactPath, manifest);
        break;
    }

    return {
      success: true,
      path: artifactPath,
      message: `Created ${type}: ${name}`,
    };
  }

  /**
   * Package an artifact for distribution
   */
  async package(
    artifactPath: string,
    options: PackageOptions = {}
  ): Promise<PackageResult> {
    // Validate first
    const validation = await this.validate(artifactPath);
    if (!validation.valid) {
      return {
        success: false,
        message: `Validation failed:\n${validation.errors.join('\n')}`,
      };
    }

    // Load manifest
    const manifest = await this.loadManifest(artifactPath);
    if (!manifest) {
      return {
        success: false,
        message: 'No manifest.yaml found',
      };
    }

    // Update manifest
    manifest.files = await this.listFiles(artifactPath, options);
    manifest.checksum = await this.calculateChecksum(artifactPath, manifest.files);
    manifest.updatedAt = new Date().toISOString();

    // Save updated manifest
    await this.saveManifest(artifactPath, manifest);

    if (options.compress) {
      // Create archive
      const outputDir = options.output || path.join(this.omgbuildDir, 'dist');
      await fs.ensureDir(outputDir);
      
      const archiveName = `${manifest.name}-${manifest.version}.tar.gz`;
      const archivePath = path.join(outputDir, archiveName);

      await this.createArchive(artifactPath, archivePath, manifest.files);

      const stats = await fs.stat(archivePath);
      return {
        success: true,
        manifest,
        packagePath: archivePath,
        size: stats.size,
        message: `Packaged: ${archiveName} (${this.formatSize(stats.size)})`,
      };
    }

    return {
      success: true,
      manifest,
      packagePath: artifactPath,
      message: `Prepared: ${manifest.name}@${manifest.version}`,
    };
  }

  /**
   * Validate an artifact
   */
  async validate(artifactPath: string): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check exists
    if (!await fs.pathExists(artifactPath)) {
      return {
        valid: false,
        errors: ['Artifact path does not exist'],
        warnings: [],
      };
    }

    // Check manifest
    const manifestPath = path.join(artifactPath, 'manifest.yaml');
    if (!await fs.pathExists(manifestPath)) {
      errors.push('Missing manifest.yaml');
    } else {
      try {
        const content = await fs.readFile(manifestPath, 'utf-8');
        const manifest = yaml.load(content) as ArtifactManifest;

        // Required fields
        if (!manifest.name) errors.push('Manifest missing: name');
        if (!manifest.version) errors.push('Manifest missing: version');
        if (!manifest.type) errors.push('Manifest missing: type');
        if (!manifest.description) warnings.push('Manifest missing: description');

        // Version format
        if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
          warnings.push('Version should follow semver (e.g., 1.0.0)');
        }

        // Type-specific validation
        if (manifest.type === 'skill') {
          const skillPath = path.join(artifactPath, 'skill.yaml');
          if (!await fs.pathExists(skillPath)) {
            errors.push('Skill artifact missing: skill.yaml');
          }
        }

        if (manifest.type === 'workflow') {
          const workflowPath = path.join(artifactPath, 'workflow.yaml');
          if (!await fs.pathExists(workflowPath)) {
            errors.push('Workflow artifact missing: workflow.yaml');
          }
        }

        if (manifest.type === 'pipeline') {
          const pipelinePath = path.join(artifactPath, 'pipeline.yaml');
          if (!await fs.pathExists(pipelinePath)) {
            errors.push('Pipeline artifact missing: pipeline.yaml');
          }
        }

      } catch (e) {
        errors.push(`Invalid manifest.yaml: ${(e as Error).message}`);
      }
    }

    // Check README
    const readmePath = path.join(artifactPath, 'README.md');
    if (!await fs.pathExists(readmePath)) {
      warnings.push('Missing README.md');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Bump artifact version
   */
  async bumpVersion(
    artifactPath: string,
    type: 'major' | 'minor' | 'patch' = 'patch'
  ): Promise<string> {
    const manifest = await this.loadManifest(artifactPath);
    if (!manifest) throw new Error('No manifest found');

    const parts = manifest.version.split('.').map(Number);
    
    switch (type) {
      case 'major':
        parts[0]++;
        parts[1] = 0;
        parts[2] = 0;
        break;
      case 'minor':
        parts[1]++;
        parts[2] = 0;
        break;
      case 'patch':
        parts[2]++;
        break;
    }

    manifest.version = parts.join('.');
    manifest.updatedAt = new Date().toISOString();
    
    await this.saveManifest(artifactPath, manifest);
    return manifest.version;
  }

  // ==========================================================================
  // TEMPLATES
  // ==========================================================================

  private async createSkillTemplate(artifactPath: string, manifest: ArtifactManifest): Promise<void> {
    // manifest.yaml
    manifest.files = ['skill.yaml', 'README.md'];
    manifest.main = 'skill.yaml';
    await this.saveManifest(artifactPath, manifest);

    // skill.yaml
    const skill = {
      name: manifest.name,
      description: manifest.description,
      version: manifest.version,
      model: 'claude-sonnet-4-20250514',
      temperature: 0.7,
      prompt: `You are an expert assistant for ${manifest.name}.

## Instructions
[Add your instructions here]

## Guidelines
- Be helpful and accurate
- Provide examples when useful
`,
    };
    await fs.writeFile(
      path.join(artifactPath, 'skill.yaml'),
      yaml.dump(skill),
      'utf-8'
    );

    // README.md
    const readme = `# ${manifest.name}

${manifest.description}

## Usage

\`\`\`bash
omgbuild skill run ${manifest.name}
\`\`\`

## Configuration

Edit \`skill.yaml\` to customize the skill.
`;
    await fs.writeFile(path.join(artifactPath, 'README.md'), readme, 'utf-8');
  }

  private async createWorkflowTemplate(artifactPath: string, manifest: ArtifactManifest): Promise<void> {
    manifest.files = ['workflow.yaml', 'README.md'];
    manifest.main = 'workflow.yaml';
    await this.saveManifest(artifactPath, manifest);

    const workflow = {
      name: manifest.name,
      description: manifest.description,
      version: manifest.version,
      triggers: ['manual'],
      steps: [
        {
          id: 'step-1',
          name: 'First Step',
          skill: 'analyze',
          input: '${input}',
        },
      ],
    };
    await fs.writeFile(
      path.join(artifactPath, 'workflow.yaml'),
      yaml.dump(workflow),
      'utf-8'
    );

    const readme = `# ${manifest.name}

${manifest.description}

## Usage

\`\`\`bash
omgbuild workflow run ${manifest.name}
\`\`\`
`;
    await fs.writeFile(path.join(artifactPath, 'README.md'), readme, 'utf-8');
  }

  private async createPipelineTemplate(artifactPath: string, manifest: ArtifactManifest): Promise<void> {
    manifest.files = ['pipeline.yaml', 'README.md'];
    manifest.main = 'pipeline.yaml';
    await this.saveManifest(artifactPath, manifest);

    const pipeline = {
      name: manifest.name,
      description: manifest.description,
      version: manifest.version,
      variables: {},
      steps: [
        {
          id: 'step-1',
          name: 'First Step',
          tool: 'auto',
          task: 'Describe the task here',
        },
      ],
    };
    await fs.writeFile(
      path.join(artifactPath, 'pipeline.yaml'),
      yaml.dump(pipeline),
      'utf-8'
    );

    const readme = `# ${manifest.name}

${manifest.description}

## Usage

\`\`\`bash
omgbuild pipe run ./${manifest.name}/pipeline.yaml
\`\`\`
`;
    await fs.writeFile(path.join(artifactPath, 'README.md'), readme, 'utf-8');
  }

  private async createTemplateTemplate(artifactPath: string, manifest: ArtifactManifest): Promise<void> {
    manifest.files = ['template.yaml', 'files/', 'README.md'];
    manifest.main = 'template.yaml';
    await this.saveManifest(artifactPath, manifest);

    await fs.ensureDir(path.join(artifactPath, 'files'));

    const template = {
      name: manifest.name,
      description: manifest.description,
      version: manifest.version,
      variables: [
        { name: 'PROJECT_NAME', prompt: 'Project name', default: 'my-project' },
      ],
      files: ['files/**/*'],
      postCreate: [],
    };
    await fs.writeFile(
      path.join(artifactPath, 'template.yaml'),
      yaml.dump(template),
      'utf-8'
    );

    const readme = `# ${manifest.name}

${manifest.description}

## Usage

\`\`\`bash
omgbuild init ${manifest.name}
\`\`\`
`;
    await fs.writeFile(path.join(artifactPath, 'README.md'), readme, 'utf-8');
  }

  private async createAgentTemplate(artifactPath: string, manifest: ArtifactManifest): Promise<void> {
    manifest.files = ['agent.yaml', 'README.md'];
    manifest.main = 'agent.yaml';
    await this.saveManifest(artifactPath, manifest);

    const agent = {
      name: manifest.name,
      description: manifest.description,
      version: manifest.version,
      role: 'custom',
      emoji: '🤖',
      responsibilities: ['Custom responsibility'],
      skills: ['analyze', 'code'],
      taskTypes: ['feature'],
      systemPrompt: `You are ${manifest.name}, a specialized AI agent.

## Your Role
[Describe the agent's role]

## Your Approach
[Describe how the agent works]
`,
    };
    await fs.writeFile(
      path.join(artifactPath, 'agent.yaml'),
      yaml.dump(agent),
      'utf-8'
    );

    const readme = `# ${manifest.name}

${manifest.description}

## Usage

Add this agent to your team configuration.
`;
    await fs.writeFile(path.join(artifactPath, 'README.md'), readme, 'utf-8');
  }

  private async createPluginTemplate(artifactPath: string, manifest: ArtifactManifest): Promise<void> {
    manifest.files = ['plugin.yaml', 'index.ts', 'README.md'];
    manifest.main = 'index.ts';
    await this.saveManifest(artifactPath, manifest);

    const plugin = {
      name: manifest.name,
      description: manifest.description,
      version: manifest.version,
      main: 'index.ts',
      hooks: ['onInit', 'onCommand'],
    };
    await fs.writeFile(
      path.join(artifactPath, 'plugin.yaml'),
      yaml.dump(plugin),
      'utf-8'
    );

    const indexTs = `/**
 * ${manifest.name} Plugin
 * ${manifest.description}
 */

export default {
  name: '${manifest.name}',
  version: '${manifest.version}',

  async onInit(context: any) {
    console.log('Plugin initialized');
  },

  async onCommand(command: string, args: string[], context: any) {
    // Handle commands
  },
};
`;
    await fs.writeFile(path.join(artifactPath, 'index.ts'), indexTs, 'utf-8');

    const readme = `# ${manifest.name}

${manifest.description}

## Installation

\`\`\`bash
omgbuild plugin install ./${manifest.name}
\`\`\`
`;
    await fs.writeFile(path.join(artifactPath, 'README.md'), readme, 'utf-8');
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private async loadManifest(artifactPath: string): Promise<ArtifactManifest | null> {
    const manifestPath = path.join(artifactPath, 'manifest.yaml');
    if (!await fs.pathExists(manifestPath)) return null;
    const content = await fs.readFile(manifestPath, 'utf-8');
    return yaml.load(content) as ArtifactManifest;
  }

  private async saveManifest(artifactPath: string, manifest: ArtifactManifest): Promise<void> {
    const manifestPath = path.join(artifactPath, 'manifest.yaml');
    await fs.writeFile(manifestPath, yaml.dump(manifest), 'utf-8');
  }

  private async listFiles(artifactPath: string, options: PackageOptions): Promise<string[]> {
    const files: string[] = [];
    const exclude = options.exclude || ['.git', 'node_modules', '.DS_Store'];

    const walk = async (dir: string, prefix: string = '') => {
      const items = await fs.readdir(dir);
      for (const item of items) {
        if (exclude.some(e => item === e || item.startsWith(e))) continue;
        
        const fullPath = path.join(dir, item);
        const relativePath = prefix ? `${prefix}/${item}` : item;
        const stat = await fs.stat(fullPath);
        
        if (stat.isDirectory()) {
          await walk(fullPath, relativePath);
        } else {
          files.push(relativePath);
        }
      }
    };

    await walk(artifactPath);
    return files;
  }

  private async calculateChecksum(artifactPath: string, files: string[]): Promise<string> {
    const hash = createHash('sha256');
    
    for (const file of files.sort()) {
      const content = await fs.readFile(path.join(artifactPath, file));
      hash.update(content);
    }
    
    return hash.digest('hex').slice(0, 16);
  }

  private async createArchive(
    sourcePath: string,
    outputPath: string,
    files: string[]
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('tar', { gzip: true });

      output.on('close', resolve);
      archive.on('error', reject);

      archive.pipe(output);

      for (const file of files) {
        archive.file(path.join(sourcePath, file), { name: file });
      }

      archive.finalize();
    });
  }

  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let unitIndex = 0;
    let size = bytes;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createArtifactPackager(omgbuildDir: string): ArtifactPackager {
  return new ArtifactPackager(omgbuildDir);
}
