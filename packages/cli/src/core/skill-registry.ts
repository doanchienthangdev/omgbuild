/**
 * 🔮 OMGBUILD Skill Registry
 * Marketplace for installing and managing skills
 */

import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';

// ============================================================================
// TYPES
// ============================================================================

export interface SkillManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  tags: string[];
  category: 'core' | 'development' | 'testing' | 'security' | 'devops' | 'documentation' | 'design' | 'custom';
  dependencies?: string[];
  ai: {
    recommended_model: string;
    min_tokens: number;
    supports_streaming: boolean;
  };
  files: string[];
  homepage?: string;
  repository?: string;
}

export interface RegistrySkill {
  name: string;
  version: string;
  description: string;
  author: string;
  category: string;
  tags: string[];
  downloads: number;
  rating: number;
  updated: string;
  source: 'official' | 'community' | 'local';
}

export interface InstalledSkill {
  name: string;
  version: string;
  installedAt: string;
  source: string;
  path: string;
}

// ============================================================================
// BUILT-IN SKILLS CATALOG
// ============================================================================

const BUILTIN_SKILLS: Record<string, SkillManifest> = {
  // Core Skills
  'analyze': {
    name: 'analyze',
    version: '1.0.0',
    description: 'Requirements analysis, gap detection, and risk assessment',
    author: 'OMGBUILD',
    license: 'MIT',
    tags: ['requirements', 'analysis', 'planning'],
    category: 'core',
    ai: { recommended_model: 'claude-sonnet-4-20250514', min_tokens: 2000, supports_streaming: true },
    files: ['SKILL.md', 'prompts/analyze.md', 'examples/'],
  },
  'code': {
    name: 'code',
    version: '1.0.0',
    description: 'High-quality code generation following best practices',
    author: 'OMGBUILD',
    license: 'MIT',
    tags: ['coding', 'generation', 'development'],
    category: 'development',
    ai: { recommended_model: 'claude-sonnet-4-20250514', min_tokens: 4000, supports_streaming: true },
    files: ['SKILL.md', 'prompts/generate.md', 'prompts/refactor.md'],
  },
  'test': {
    name: 'test',
    version: '1.0.0',
    description: 'Comprehensive test generation with high coverage',
    author: 'OMGBUILD',
    license: 'MIT',
    tags: ['testing', 'quality', 'automation'],
    category: 'testing',
    ai: { recommended_model: 'claude-sonnet-4-20250514', min_tokens: 3000, supports_streaming: true },
    files: ['SKILL.md', 'prompts/unit.md', 'prompts/integration.md'],
  },
  'architect': {
    name: 'architect',
    version: '1.0.0',
    description: 'System design and architecture decisions',
    author: 'OMGBUILD',
    license: 'MIT',
    tags: ['architecture', 'design', 'planning'],
    category: 'core',
    ai: { recommended_model: 'claude-sonnet-4-20250514', min_tokens: 4000, supports_streaming: true },
    files: ['SKILL.md', 'prompts/design.md', 'templates/adr.md'],
  },
  'review': {
    name: 'review',
    version: '1.0.0',
    description: 'Code review with Big Tech standards',
    author: 'OMGBUILD',
    license: 'MIT',
    tags: ['review', 'quality', 'standards'],
    category: 'development',
    ai: { recommended_model: 'claude-sonnet-4-20250514', min_tokens: 3000, supports_streaming: true },
    files: ['SKILL.md', 'prompts/review.md', 'checklists/'],
  },
  'security': {
    name: 'security',
    version: '1.0.0',
    description: 'Security vulnerability detection and prevention',
    author: 'OMGBUILD',
    license: 'MIT',
    tags: ['security', 'audit', 'vulnerabilities'],
    category: 'security',
    ai: { recommended_model: 'claude-sonnet-4-20250514', min_tokens: 3000, supports_streaming: true },
    files: ['SKILL.md', 'prompts/audit.md', 'checklists/owasp.md'],
  },
  'docs': {
    name: 'docs',
    version: '1.0.0',
    description: 'Documentation generation and maintenance',
    author: 'OMGBUILD',
    license: 'MIT',
    tags: ['documentation', 'readme', 'api-docs'],
    category: 'documentation',
    ai: { recommended_model: 'claude-haiku-4-5-20251001', min_tokens: 2000, supports_streaming: true },
    files: ['SKILL.md', 'prompts/readme.md', 'templates/'],
  },
  'ux': {
    name: 'ux',
    version: '1.0.0',
    description: 'User experience analysis and improvement',
    author: 'OMGBUILD',
    license: 'MIT',
    tags: ['ux', 'design', 'usability'],
    category: 'design',
    ai: { recommended_model: 'claude-sonnet-4-20250514', min_tokens: 2000, supports_streaming: true },
    files: ['SKILL.md', 'prompts/analyze-ux.md'],
  },

  // Extended Skills
  'api-design': {
    name: 'api-design',
    version: '1.0.0',
    description: 'RESTful and GraphQL API design',
    author: 'OMGBUILD',
    license: 'MIT',
    tags: ['api', 'rest', 'graphql', 'openapi'],
    category: 'development',
    ai: { recommended_model: 'claude-sonnet-4-20250514', min_tokens: 3000, supports_streaming: true },
    files: ['SKILL.md', 'templates/openapi.yaml'],
  },
  'database': {
    name: 'database',
    version: '1.0.0',
    description: 'Database schema design and optimization',
    author: 'OMGBUILD',
    license: 'MIT',
    tags: ['database', 'sql', 'schema', 'optimization'],
    category: 'development',
    ai: { recommended_model: 'claude-sonnet-4-20250514', min_tokens: 3000, supports_streaming: true },
    files: ['SKILL.md', 'prompts/schema.md', 'prompts/optimize.md'],
  },
  'devops': {
    name: 'devops',
    version: '1.0.0',
    description: 'CI/CD, infrastructure, and deployment',
    author: 'OMGBUILD',
    license: 'MIT',
    tags: ['devops', 'ci-cd', 'deployment', 'infrastructure'],
    category: 'devops',
    ai: { recommended_model: 'claude-sonnet-4-20250514', min_tokens: 3000, supports_streaming: true },
    files: ['SKILL.md', 'templates/github-actions/', 'templates/docker/'],
  },
  'performance': {
    name: 'performance',
    version: '1.0.0',
    description: 'Performance analysis and optimization',
    author: 'OMGBUILD',
    license: 'MIT',
    tags: ['performance', 'optimization', 'profiling'],
    category: 'development',
    ai: { recommended_model: 'claude-sonnet-4-20250514', min_tokens: 3000, supports_streaming: true },
    files: ['SKILL.md', 'prompts/analyze.md', 'checklists/'],
  },
  'refactor': {
    name: 'refactor',
    version: '1.0.0',
    description: 'Code refactoring and modernization',
    author: 'OMGBUILD',
    license: 'MIT',
    tags: ['refactoring', 'clean-code', 'modernization'],
    category: 'development',
    ai: { recommended_model: 'claude-sonnet-4-20250514', min_tokens: 4000, supports_streaming: true },
    files: ['SKILL.md', 'prompts/refactor.md', 'patterns/'],
  },
  'debug': {
    name: 'debug',
    version: '1.0.0',
    description: 'Debugging and troubleshooting assistance',
    author: 'OMGBUILD',
    license: 'MIT',
    tags: ['debugging', 'troubleshooting', 'errors'],
    category: 'development',
    ai: { recommended_model: 'claude-sonnet-4-20250514', min_tokens: 3000, supports_streaming: true },
    files: ['SKILL.md', 'prompts/debug.md'],
  },
};

// ============================================================================
// SKILL REGISTRY
// ============================================================================

export class SkillRegistry {
  private omgbuildDir: string;
  private skillsDir: string;
  private installedSkills: Map<string, InstalledSkill> = new Map();

  constructor(omgbuildDir: string) {
    this.omgbuildDir = omgbuildDir;
    this.skillsDir = path.join(omgbuildDir, 'skills');
  }

  /**
   * Initialize registry and load installed skills
   */
  async initialize(): Promise<void> {
    await this.loadInstalledSkills();
  }

  /**
   * Load installed skills from disk
   */
  private async loadInstalledSkills(): Promise<void> {
    if (!await fs.pathExists(this.skillsDir)) {
      return;
    }

    const dirs = await fs.readdir(this.skillsDir);
    for (const dir of dirs) {
      const skillPath = path.join(this.skillsDir, dir);
      const manifestPath = path.join(skillPath, 'manifest.yaml');
      const skillMdPath = path.join(skillPath, 'SKILL.md');

      if (await fs.pathExists(skillMdPath)) {
        let version = '1.0.0';
        let source = 'local';

        if (await fs.pathExists(manifestPath)) {
          const content = await fs.readFile(manifestPath, 'utf-8');
          const manifest = yaml.load(content) as Partial<SkillManifest>;
          version = manifest.version || '1.0.0';
        }

        this.installedSkills.set(dir, {
          name: dir,
          version,
          installedAt: new Date().toISOString(),
          source,
          path: skillPath,
        });
      }
    }
  }

  /**
   * List all available skills (installed + registry)
   */
  async listAvailable(): Promise<RegistrySkill[]> {
    const skills: RegistrySkill[] = [];

    // Add built-in skills
    for (const [name, manifest] of Object.entries(BUILTIN_SKILLS)) {
      const installed = this.installedSkills.get(name);
      skills.push({
        name,
        version: manifest.version,
        description: manifest.description,
        author: manifest.author,
        category: manifest.category,
        tags: manifest.tags,
        downloads: 0,
        rating: 5.0,
        updated: new Date().toISOString(),
        source: 'official',
      });
    }

    return skills;
  }

  /**
   * List installed skills
   */
  listInstalled(): InstalledSkill[] {
    return Array.from(this.installedSkills.values());
  }

  /**
   * Check if a skill is installed
   */
  isInstalled(name: string): boolean {
    return this.installedSkills.has(name);
  }

  /**
   * Get skill info
   */
  getSkillInfo(name: string): SkillManifest | null {
    return BUILTIN_SKILLS[name] || null;
  }

  /**
   * Install a skill
   */
  async install(name: string, options: { force?: boolean } = {}): Promise<void> {
    const manifest = BUILTIN_SKILLS[name];
    if (!manifest) {
      throw new Error(`Skill not found in registry: ${name}`);
    }

    const skillPath = path.join(this.skillsDir, name);

    if (await fs.pathExists(skillPath) && !options.force) {
      throw new Error(`Skill already installed: ${name}. Use --force to reinstall.`);
    }

    // Create skill directory
    await fs.ensureDir(skillPath);

    // Generate SKILL.md
    const skillContent = this.generateSkillContent(manifest);
    await fs.writeFile(path.join(skillPath, 'SKILL.md'), skillContent, 'utf-8');

    // Save manifest
    await fs.writeFile(
      path.join(skillPath, 'manifest.yaml'),
      yaml.dump(manifest),
      'utf-8'
    );

    // Update installed skills
    this.installedSkills.set(name, {
      name,
      version: manifest.version,
      installedAt: new Date().toISOString(),
      source: 'official',
      path: skillPath,
    });
  }

  /**
   * Uninstall a skill
   */
  async uninstall(name: string): Promise<void> {
    const skillPath = path.join(this.skillsDir, name);

    if (!await fs.pathExists(skillPath)) {
      throw new Error(`Skill not installed: ${name}`);
    }

    await fs.remove(skillPath);
    this.installedSkills.delete(name);
  }

  /**
   * Update a skill
   */
  async update(name: string): Promise<void> {
    await this.install(name, { force: true });
  }

  /**
   * Update all skills
   */
  async updateAll(): Promise<string[]> {
    const updated: string[] = [];
    
    for (const skill of this.installedSkills.values()) {
      try {
        await this.update(skill.name);
        updated.push(skill.name);
      } catch {
        // Skip skills that can't be updated
      }
    }

    return updated;
  }

  /**
   * Search skills
   */
  async search(query: string): Promise<RegistrySkill[]> {
    const all = await this.listAvailable();
    const queryLower = query.toLowerCase();

    return all.filter(skill =>
      skill.name.toLowerCase().includes(queryLower) ||
      skill.description.toLowerCase().includes(queryLower) ||
      skill.tags.some(t => t.toLowerCase().includes(queryLower)) ||
      skill.category.toLowerCase().includes(queryLower)
    );
  }

  /**
   * Generate SKILL.md content
   */
  private generateSkillContent(manifest: SkillManifest): string {
    return `# 🔮 ${manifest.name.charAt(0).toUpperCase() + manifest.name.slice(1)} Skill

## Purpose
${manifest.description}

## Version
${manifest.version}

## Category
${manifest.category}

## Tags
${manifest.tags.map(t => `\`${t}\``).join(', ')}

## When to Use
- [Describe when this skill should be used]

## Capabilities
${manifest.tags.map((t, i) => `${i + 1}. **${t}** - [Capability description]`).join('\n')}

## Input Format
\`\`\`yaml
type: ${manifest.name}
title: "Short description"
description: |
  Detailed description of what's needed
context:
  - Any relevant context
\`\`\`

## Output Format
\`\`\`yaml
${manifest.name}:
  summary: "One paragraph summary"
  
  results:
    - item: "Result item"
      details: "Details"
      
  recommendations:
    - "Recommendation 1"
    - "Recommendation 2"
    
  next_steps:
    - "Action 1"
    - "Action 2"
\`\`\`

## AI Configuration
- **Recommended Model**: ${manifest.ai.recommended_model}
- **Minimum Tokens**: ${manifest.ai.min_tokens}
- **Streaming**: ${manifest.ai.supports_streaming ? 'Supported' : 'Not supported'}

## Integration Points
- **Input from**: [Previous skills]
- **Output to**: [Next skills]

---
*OMGBUILD Skill v${manifest.version}*
`;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export async function createSkillRegistry(omgbuildDir: string): Promise<SkillRegistry> {
  const registry = new SkillRegistry(omgbuildDir);
  await registry.initialize();
  return registry;
}
