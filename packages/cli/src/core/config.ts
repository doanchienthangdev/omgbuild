/**
 * 🔮 OMGBUILD Config Module
 * Load and manage configuration
 */

import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';

export interface OmgbuildConfig {
  project: {
    name: string;
    type: string;
    version: string;
    description?: string;
  };
  ai: {
    default_model: string;
    routing: Record<string, string>;
    fallbacks: string[];
  };
  skills: {
    enabled: string[];
  };
  workflows: {
    default_branch: string;
    feature_branch_prefix: string;
    bugfix_branch_prefix: string;
    require_review: boolean;
    require_tests: boolean;
    auto_generate_docs: boolean;
  };
  gates: {
    test_coverage_min: number;
    lint_errors_max: number;
    security_vulnerabilities_max: number;
  };
  memory: {
    enabled: boolean;
    max_decisions: number;
    max_patterns: number;
    retention_days: number;
  };
}

const DEFAULT_CONFIG: OmgbuildConfig = {
  project: {
    name: 'unnamed',
    type: 'minimal',
    version: '0.1.0',
  },
  ai: {
    default_model: 'claude-sonnet-4-20250514',
    routing: {
      analyze: 'claude-sonnet-4-20250514',
      code: 'claude-sonnet-4-20250514',
      test: 'claude-sonnet-4-20250514',
    },
    fallbacks: ['gpt-4o', 'gemini-1.5-pro'],
  },
  skills: {
    enabled: ['analyze', 'code', 'test'],
  },
  workflows: {
    default_branch: 'main',
    feature_branch_prefix: 'feature/',
    bugfix_branch_prefix: 'bugfix/',
    require_review: false,
    require_tests: true,
    auto_generate_docs: false,
  },
  gates: {
    test_coverage_min: 60,
    lint_errors_max: 0,
    security_vulnerabilities_max: 0,
  },
  memory: {
    enabled: true,
    max_decisions: 1000,
    max_patterns: 500,
    retention_days: 365,
  },
};

export class ConfigManager {
  private config: OmgbuildConfig;
  private configPath: string;

  constructor(private omgbuildDir: string) {
    this.configPath = path.join(omgbuildDir, 'config.yaml');
    this.config = { ...DEFAULT_CONFIG };
  }

  async load(): Promise<OmgbuildConfig> {
    if (await fs.pathExists(this.configPath)) {
      const content = await fs.readFile(this.configPath, 'utf-8');
      const loaded = yaml.load(content) as Partial<OmgbuildConfig>;
      this.config = this.mergeConfig(DEFAULT_CONFIG, loaded);
    }
    return this.config;
  }

  async save(): Promise<void> {
    const content = yaml.dump(this.config, { 
      indent: 2,
      lineWidth: 120,
    });
    await fs.writeFile(this.configPath, content, 'utf-8');
  }

  get(): OmgbuildConfig {
    return this.config;
  }

  set(path: string, value: unknown): void {
    const keys = path.split('.');
    let current: Record<string, unknown> = this.config as unknown as Record<string, unknown>;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]] as Record<string, unknown>;
    }
    
    current[keys[keys.length - 1]] = value;
  }

  getModel(skill: string): string {
    return this.config.ai.routing[skill] || this.config.ai.default_model;
  }

  isSkillEnabled(skill: string): boolean {
    return this.config.skills.enabled.includes(skill);
  }

  private mergeConfig(
    defaults: OmgbuildConfig, 
    overrides: Partial<OmgbuildConfig>
  ): OmgbuildConfig {
    return {
      ...defaults,
      ...overrides,
      project: { ...defaults.project, ...overrides.project },
      ai: { ...defaults.ai, ...overrides.ai },
      skills: { ...defaults.skills, ...overrides.skills },
      workflows: { ...defaults.workflows, ...overrides.workflows },
      gates: { ...defaults.gates, ...overrides.gates },
      memory: { ...defaults.memory, ...overrides.memory },
    };
  }
}

export async function loadConfig(cwd?: string): Promise<OmgbuildConfig> {
  const omgbuildDir = path.join(cwd || process.cwd(), '.omgbuild');
  const manager = new ConfigManager(omgbuildDir);
  return manager.load();
}

export async function findOmgbuildDir(startDir?: string): Promise<string | null> {
  let current = startDir || process.cwd();
  const root = path.parse(current).root;

  while (current !== root) {
    const omgbuildPath = path.join(current, '.omgbuild');
    if (await fs.pathExists(omgbuildPath)) {
      return omgbuildPath;
    }
    current = path.dirname(current);
  }

  return null;
}
