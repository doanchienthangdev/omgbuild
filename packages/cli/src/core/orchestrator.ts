/**
 * 🔮 OMGBUILD Orchestrator Module
 * Orchestrate AI agents and workflows
 */

import fs from 'fs-extra';
import path from 'path';
import { ConfigManager, OmgbuildConfig } from './config';
import { parseSkill, parseWorkflow, getWorkflowStageOrder, Skill, Workflow, WorkflowStage } from './parser';

// ============================================================================
// TYPES
// ============================================================================

export interface AgentContext {
  projectName: string;
  workingDir: string;
  omgbuildDir: string;
  config: OmgbuildConfig;
  skills: Map<string, Skill>;
  memory: ProjectMemory;
}

export interface AgentResult {
  success: boolean;
  output: unknown;
  artifacts: string[];
  errors: string[];
  duration: number;
}

export interface WorkflowExecution {
  id: string;
  workflow: Workflow;
  context: AgentContext;
  status: 'pending' | 'running' | 'completed' | 'failed';
  currentStage: string | null;
  stageResults: Map<string, AgentResult>;
  startedAt: Date;
  completedAt: Date | null;
}

export interface ProjectMemory {
  decisions: Array<{
    id: string;
    date: string;
    title: string;
    context: string;
    decision: string;
    consequences: string[];
  }>;
  patterns: Array<{
    id: string;
    name: string;
    description: string;
    occurrences: number;
    lastSeen: string;
  }>;
  learnings: Array<{
    id: string;
    date: string;
    category: string;
    learning: string;
    source: string;
  }>;
}

// ============================================================================
// ORCHESTRATOR
// ============================================================================

export class Orchestrator {
  private context: AgentContext | null = null;
  private executions: Map<string, WorkflowExecution> = new Map();

  constructor(private omgbuildDir: string) {}

  /**
   * Initialize the orchestrator with project context
   */
  async initialize(): Promise<AgentContext> {
    const configManager = new ConfigManager(this.omgbuildDir);
    const config = await configManager.load();

    // Load all skills
    const skills = new Map<string, Skill>();
    const skillsDir = path.join(this.omgbuildDir, 'skills');
    
    if (await fs.pathExists(skillsDir)) {
      const skillDirs = await fs.readdir(skillsDir);
      for (const skillName of skillDirs) {
        const skillPath = path.join(skillsDir, skillName, 'SKILL.md');
        if (await fs.pathExists(skillPath)) {
          skills.set(skillName, await parseSkill(skillPath));
        }
      }
    }

    // Load project memory
    const memory = await this.loadMemory();

    this.context = {
      projectName: config.project.name,
      workingDir: path.dirname(this.omgbuildDir),
      omgbuildDir: this.omgbuildDir,
      config,
      skills,
      memory,
    };

    return this.context;
  }

  /**
   * Get the current context
   */
  getContext(): AgentContext | null {
    return this.context;
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(
    workflowName: string,
    input: Record<string, unknown>
  ): Promise<WorkflowExecution> {
    if (!this.context) {
      await this.initialize();
    }

    const workflowPath = path.join(this.omgbuildDir, 'workflows', `${workflowName}.yaml`);
    
    if (!await fs.pathExists(workflowPath)) {
      throw new Error(`Workflow not found: ${workflowName}`);
    }

    const workflow = await parseWorkflow(workflowPath);
    const executionId = `${workflowName}-${Date.now()}`;

    const execution: WorkflowExecution = {
      id: executionId,
      workflow,
      context: this.context!,
      status: 'pending',
      currentStage: null,
      stageResults: new Map(),
      startedAt: new Date(),
      completedAt: null,
    };

    this.executions.set(executionId, execution);

    // Get stage order
    const stageOrder = getWorkflowStageOrder(workflow);

    // Execute stages in order
    execution.status = 'running';
    
    for (const stageId of stageOrder) {
      const stage = workflow.stages.find(s => s.id === stageId);
      if (!stage) continue;

      execution.currentStage = stageId;

      try {
        const result = await this.executeStage(execution, stage, input);
        execution.stageResults.set(stageId, result);

        if (!result.success) {
          execution.status = 'failed';
          break;
        }
      } catch (error) {
        execution.stageResults.set(stageId, {
          success: false,
          output: null,
          artifacts: [],
          errors: [(error as Error).message],
          duration: 0,
        });
        execution.status = 'failed';
        break;
      }
    }

    if (execution.status === 'running') {
      execution.status = 'completed';
    }

    execution.completedAt = new Date();
    execution.currentStage = null;

    // Save execution record
    await this.saveExecution(execution);

    return execution;
  }

  /**
   * Execute a single stage
   */
  private async executeStage(
    execution: WorkflowExecution,
    stage: WorkflowStage,
    input: Record<string, unknown>
  ): Promise<AgentResult> {
    const startTime = Date.now();

    // For now, return a placeholder result
    // In the future, this will integrate with actual AI providers
    
    const result: AgentResult = {
      success: true,
      output: {
        stage: stage.id,
        name: stage.name,
        skill: stage.skill,
        message: `Stage ${stage.name} executed. In production, this would invoke the ${stage.skill} skill.`,
        instructions: this.getStageInstructions(stage),
      },
      artifacts: [],
      errors: [],
      duration: Date.now() - startTime,
    };

    return result;
  }

  /**
   * Get instructions for executing a stage
   */
  private getStageInstructions(stage: WorkflowStage): string {
    if (!stage.skill) {
      return 'No skill specified for this stage.';
    }

    const skill = this.context?.skills.get(stage.skill);
    if (!skill) {
      return `Skill '${stage.skill}' not found.`;
    }

    return `
To execute this stage manually:

1. Read the skill definition:
   cat .omgbuild/skills/${stage.skill}/SKILL.md

2. Use with Claude Code:
   claude "Act as the ${stage.skill} agent following .omgbuild/skills/${stage.skill}/SKILL.md. ${stage.name}"

3. Or use with your IDE:
   Reference the skill in your AI assistant prompt.
    `.trim();
  }

  /**
   * Load project memory
   */
  private async loadMemory(): Promise<ProjectMemory> {
    const memory: ProjectMemory = {
      decisions: [],
      patterns: [],
      learnings: [],
    };

    const memoryDir = path.join(this.omgbuildDir, 'memory');

    // Load decisions
    const decisionsDir = path.join(memoryDir, 'decisions');
    if (await fs.pathExists(decisionsDir)) {
      const files = await fs.readdir(decisionsDir);
      for (const file of files) {
        if (file.endsWith('.yaml') || file.endsWith('.json')) {
          try {
            const content = await fs.readFile(path.join(decisionsDir, file), 'utf-8');
            const decision = file.endsWith('.yaml') 
              ? (await import('js-yaml')).load(content)
              : JSON.parse(content);
            memory.decisions.push(decision);
          } catch {
            // Skip invalid files
          }
        }
      }
    }

    // Load patterns
    const patternsDir = path.join(memoryDir, 'patterns');
    if (await fs.pathExists(patternsDir)) {
      const files = await fs.readdir(patternsDir);
      for (const file of files) {
        if (file.endsWith('.yaml') || file.endsWith('.json')) {
          try {
            const content = await fs.readFile(path.join(patternsDir, file), 'utf-8');
            const pattern = file.endsWith('.yaml')
              ? (await import('js-yaml')).load(content)
              : JSON.parse(content);
            memory.patterns.push(pattern);
          } catch {
            // Skip invalid files
          }
        }
      }
    }

    return memory;
  }

  /**
   * Save a decision to memory
   */
  async saveDecision(decision: {
    title: string;
    context: string;
    decision: string;
    consequences: string[];
  }): Promise<void> {
    const decisionsDir = path.join(this.omgbuildDir, 'memory', 'decisions');
    await fs.ensureDir(decisionsDir);

    const id = `decision-${Date.now()}`;
    const record = {
      id,
      date: new Date().toISOString(),
      ...decision,
    };

    const filePath = path.join(decisionsDir, `${id}.yaml`);
    const yaml = await import('js-yaml');
    await fs.writeFile(filePath, yaml.dump(record), 'utf-8');

    if (this.context) {
      this.context.memory.decisions.push(record);
    }
  }

  /**
   * Save a pattern to memory
   */
  async savePattern(pattern: {
    name: string;
    description: string;
  }): Promise<void> {
    const patternsDir = path.join(this.omgbuildDir, 'memory', 'patterns');
    await fs.ensureDir(patternsDir);

    // Check if pattern already exists
    const existing = this.context?.memory.patterns.find(p => p.name === pattern.name);
    
    if (existing) {
      existing.occurrences++;
      existing.lastSeen = new Date().toISOString();
      
      const filePath = path.join(patternsDir, `${existing.id}.yaml`);
      const yaml = await import('js-yaml');
      await fs.writeFile(filePath, yaml.dump(existing), 'utf-8');
    } else {
      const id = `pattern-${Date.now()}`;
      const record = {
        id,
        ...pattern,
        occurrences: 1,
        lastSeen: new Date().toISOString(),
      };

      const filePath = path.join(patternsDir, `${id}.yaml`);
      const yaml = await import('js-yaml');
      await fs.writeFile(filePath, yaml.dump(record), 'utf-8');

      if (this.context) {
        this.context.memory.patterns.push(record);
      }
    }
  }

  /**
   * Save workflow execution record
   */
  private async saveExecution(execution: WorkflowExecution): Promise<void> {
    const executionsDir = path.join(this.omgbuildDir, 'generated', 'executions');
    await fs.ensureDir(executionsDir);

    const record = {
      id: execution.id,
      workflow: execution.workflow.name,
      status: execution.status,
      startedAt: execution.startedAt.toISOString(),
      completedAt: execution.completedAt?.toISOString(),
      stageResults: Object.fromEntries(execution.stageResults),
    };

    const filePath = path.join(executionsDir, `${execution.id}.yaml`);
    const yaml = await import('js-yaml');
    await fs.writeFile(filePath, yaml.dump(record), 'utf-8');
  }

  /**
   * Generate AI prompt for a skill
   */
  generateSkillPrompt(skillName: string, input: string): string {
    const skill = this.context?.skills.get(skillName);
    if (!skill) {
      throw new Error(`Skill not found: ${skillName}`);
    }

    const rules = this.getRelevantRules(skillName);

    return `
# Agent Role: ${skill.name}

## Purpose
${skill.purpose}

## Capabilities
${skill.capabilities.map(c => `- ${c}`).join('\n')}

## Rules to Follow
${rules}

## Input Format
${skill.inputFormat}

## Expected Output Format
${skill.outputFormat}

## Your Task
${input}

## Context
- Project: ${this.context?.projectName}
- Working Directory: ${this.context?.workingDir}

Please execute this task following the skill definition and rules above.
    `.trim();
  }

  /**
   * Get relevant rules for a skill
   */
  private getRelevantRules(skillName: string): string {
    // Map skills to relevant rules
    const ruleMapping: Record<string, string[]> = {
      code: ['architecture', 'style'],
      test: ['testing'],
      review: ['review', 'style'],
      security: ['security'],
    };

    const relevantRuleNames = ruleMapping[skillName] || ['style'];
    const rules: string[] = [];

    for (const ruleName of relevantRuleNames) {
      const rulePath = path.join(this.omgbuildDir, 'rules', `${ruleName}.md`);
      // In production, would read and include rule content
      rules.push(`See: .omgbuild/rules/${ruleName}.md`);
    }

    return rules.join('\n');
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export async function createOrchestrator(cwd?: string): Promise<Orchestrator> {
  const workingDir = cwd || process.cwd();
  const omgbuildDir = path.join(workingDir, '.omgbuild');

  if (!await fs.pathExists(omgbuildDir)) {
    throw new Error('No .omgbuild directory found. Run `omgbuild init` first.');
  }

  const orchestrator = new Orchestrator(omgbuildDir);
  await orchestrator.initialize();

  return orchestrator;
}
