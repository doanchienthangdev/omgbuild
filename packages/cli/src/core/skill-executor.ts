/**
 * 🔮 OMGBUILD Skill Executor
 * Execute skills using AI agents
 */

import fs from 'fs-extra';
import path from 'path';
import { AIRouter, AIMessage, AIResponse, createAIRouter } from './ai-provider';
import { parseSkill, parseRule, Skill, Rule } from './parser';
import { ConfigManager, OmgbuildConfig } from './config';

// ============================================================================
// TYPES
// ============================================================================

export interface SkillInput {
  task: string;
  context?: Record<string, unknown>;
  files?: string[];
  previousOutput?: string;
}

export interface SkillOutput {
  success: boolean;
  content: string;
  artifacts: SkillArtifact[];
  metadata: {
    skill: string;
    model: string;
    duration: number;
    tokens: {
      input: number;
      output: number;
    };
  };
}

export interface SkillArtifact {
  type: 'file' | 'code' | 'document' | 'analysis';
  name: string;
  content: string;
  language?: string;
}

// ============================================================================
// SKILL EXECUTOR
// ============================================================================

export class SkillExecutor {
  private router: AIRouter;
  private omgbuildDir: string;
  private config: OmgbuildConfig | null = null;
  private skills: Map<string, Skill> = new Map();
  private rules: Map<string, Rule> = new Map();

  constructor(omgbuildDir: string, router: AIRouter) {
    this.omgbuildDir = omgbuildDir;
    this.router = router;
  }

  /**
   * Initialize executor with skills and rules
   */
  async initialize(): Promise<void> {
    // Load config
    const configManager = new ConfigManager(this.omgbuildDir);
    this.config = await configManager.load();

    // Load skills
    const skillsDir = path.join(this.omgbuildDir, 'skills');
    if (await fs.pathExists(skillsDir)) {
      const skillDirs = await fs.readdir(skillsDir);
      for (const skillName of skillDirs) {
        const skillPath = path.join(skillsDir, skillName, 'SKILL.md');
        if (await fs.pathExists(skillPath)) {
          this.skills.set(skillName, await parseSkill(skillPath));
        }
      }
    }

    // Load rules
    const rulesDir = path.join(this.omgbuildDir, 'rules');
    if (await fs.pathExists(rulesDir)) {
      const ruleFiles = await fs.readdir(rulesDir);
      for (const ruleFile of ruleFiles) {
        if (ruleFile.endsWith('.md')) {
          const rulePath = path.join(rulesDir, ruleFile);
          const ruleName = ruleFile.replace('.md', '');
          this.rules.set(ruleName, await parseRule(rulePath));
        }
      }
    }
  }

  /**
   * Get available skills
   */
  getSkills(): string[] {
    return Array.from(this.skills.keys());
  }

  /**
   * Execute a skill
   */
  async execute(skillName: string, input: SkillInput): Promise<SkillOutput> {
    const startTime = Date.now();

    const skill = this.skills.get(skillName);
    if (!skill) {
      throw new Error(`Skill not found: ${skillName}. Available: ${this.getSkills().join(', ')}`);
    }

    // Build the prompt
    const messages = this.buildMessages(skill, skillName, input);

    // Execute with AI
    const response = await this.router.chat(messages, skillName);

    // Parse output
    const artifacts = this.parseArtifacts(response.content);

    return {
      success: true,
      content: response.content,
      artifacts,
      metadata: {
        skill: skillName,
        model: response.model,
        duration: Date.now() - startTime,
        tokens: {
          input: response.usage?.inputTokens || 0,
          output: response.usage?.outputTokens || 0,
        },
      },
    };
  }

  /**
   * Build messages for AI
   */
  private buildMessages(skill: Skill, skillName: string, input: SkillInput): AIMessage[] {
    const messages: AIMessage[] = [];

    // System message with skill definition and rules
    const systemPrompt = this.buildSystemPrompt(skill, skillName);
    messages.push({
      role: 'system',
      content: systemPrompt,
    });

    // User message with task
    const userPrompt = this.buildUserPrompt(skill, input);
    messages.push({
      role: 'user',
      content: userPrompt,
    });

    return messages;
  }

  /**
   * Build system prompt
   */
  private buildSystemPrompt(skill: Skill, skillName: string): string {
    const relevantRules = this.getRelevantRules(skillName);

    return `# 🔮 OMGBUILD AI Agent: ${skill.name}

## Your Role
You are an AI agent specialized in: ${skill.purpose}

## Project Context
- Project: ${this.config?.project.name || 'Unknown'}
- Type: ${this.config?.project.type || 'Unknown'}

## Your Capabilities
${skill.capabilities.map(c => `- ${c}`).join('\n')}

## Rules You MUST Follow
${relevantRules.map(r => `### ${r.name}\n${r.content}`).join('\n\n')}

## Output Format
You MUST structure your output according to this format:
${skill.outputFormat}

## Important Guidelines
1. Be precise and actionable
2. Follow all project rules
3. Structure output exactly as specified
4. Include all required sections
5. Cite decisions and rationale

When generating code, wrap it in proper markdown code blocks with language identifiers.
When generating files, use this format:

\`\`\`file:filename.ext
content here
\`\`\`
`;
  }

  /**
   * Build user prompt
   */
  private buildUserPrompt(skill: Skill, input: SkillInput): string {
    let prompt = `## Task
${input.task}
`;

    if (input.context && Object.keys(input.context).length > 0) {
      prompt += `
## Additional Context
${Object.entries(input.context).map(([k, v]) => `- **${k}**: ${JSON.stringify(v)}`).join('\n')}
`;
    }

    if (input.files && input.files.length > 0) {
      prompt += `
## Related Files
${input.files.map(f => `- ${f}`).join('\n')}
`;
    }

    if (input.previousOutput) {
      prompt += `
## Previous Stage Output
${input.previousOutput}
`;
    }

    prompt += `
## Your Response
Please execute this task following your skill definition and output format.
`;

    return prompt;
  }

  /**
   * Get relevant rules for a skill
   */
  private getRelevantRules(skillName: string): Rule[] {
    const ruleMapping: Record<string, string[]> = {
      analyze: ['architecture'],
      architect: ['architecture'],
      code: ['architecture', 'style'],
      test: ['testing'],
      review: ['review', 'style', 'security'],
      security: ['security'],
      docs: ['style'],
    };

    const ruleNames = ruleMapping[skillName] || ['style'];
    const rules: Rule[] = [];

    for (const ruleName of ruleNames) {
      const rule = this.rules.get(ruleName);
      if (rule) {
        rules.push(rule);
      }
    }

    return rules;
  }

  /**
   * Parse artifacts from AI response
   */
  private parseArtifacts(content: string): SkillArtifact[] {
    const artifacts: SkillArtifact[] = [];

    // Parse file blocks: ```file:filename.ext
    const fileRegex = /```file:([^\n]+)\n([\s\S]*?)```/g;
    let match;
    while ((match = fileRegex.exec(content)) !== null) {
      artifacts.push({
        type: 'file',
        name: match[1].trim(),
        content: match[2].trim(),
      });
    }

    // Parse code blocks: ```language
    const codeRegex = /```(\w+)\n([\s\S]*?)```/g;
    while ((match = codeRegex.exec(content)) !== null) {
      // Skip file blocks we already parsed
      if (match[1].startsWith('file:')) continue;
      
      artifacts.push({
        type: 'code',
        name: `code-${artifacts.length + 1}`,
        content: match[2].trim(),
        language: match[1],
      });
    }

    // Parse YAML/JSON analysis blocks
    const analysisRegex = /```(yaml|json)\n([\s\S]*?)```/g;
    while ((match = analysisRegex.exec(content)) !== null) {
      artifacts.push({
        type: 'analysis',
        name: `analysis.${match[1]}`,
        content: match[2].trim(),
        language: match[1],
      });
    }

    return artifacts;
  }

  /**
   * Save artifacts to disk
   */
  async saveArtifacts(
    artifacts: SkillArtifact[],
    outputDir: string
  ): Promise<string[]> {
    await fs.ensureDir(outputDir);
    const savedPaths: string[] = [];

    for (const artifact of artifacts) {
      if (artifact.type === 'file') {
        const filePath = path.join(outputDir, artifact.name);
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, artifact.content, 'utf-8');
        savedPaths.push(filePath);
      } else if (artifact.type === 'analysis') {
        const filePath = path.join(outputDir, artifact.name);
        await fs.writeFile(filePath, artifact.content, 'utf-8');
        savedPaths.push(filePath);
      }
    }

    return savedPaths;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export async function createSkillExecutor(omgbuildDir: string): Promise<SkillExecutor> {
  const router = await createAIRouter(omgbuildDir);
  const executor = new SkillExecutor(omgbuildDir, router);
  await executor.initialize();
  return executor;
}
