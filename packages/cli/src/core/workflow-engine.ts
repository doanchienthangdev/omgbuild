/**
 * 🔮 OMGBUILD Workflow Engine
 * Interactive workflow execution with AI agents
 */

import fs from 'fs-extra';
import path from 'path';
import { parseWorkflow, Workflow, WorkflowStage, getWorkflowStageOrder } from './parser';
import { SkillExecutor, SkillInput, SkillOutput, createSkillExecutor } from './skill-executor';
import { MemoryManager, createMemoryManager } from './memory';

// Re-export types needed by other modules
export type { WorkflowStage };

// ============================================================================
// TYPES
// ============================================================================

export interface WorkflowContext {
  workflowName: string;
  description: string;
  startedAt: Date;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  currentStage: string | null;
  stageOutputs: Map<string, SkillOutput>;
  artifactsDir: string;
  userInputs: Map<string, string>;
}

export interface StageResult {
  stageId: string;
  success: boolean;
  output?: SkillOutput;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

export interface WorkflowResult {
  success: boolean;
  context: WorkflowContext;
  stageResults: StageResult[];
  artifacts: string[];
  duration: number;
}

export type StageCallback = (
  stage: WorkflowStage,
  context: WorkflowContext
) => Promise<{ proceed: boolean; input?: string }>;

export type ProgressCallback = (
  stage: WorkflowStage,
  status: 'starting' | 'completed' | 'failed' | 'skipped',
  result?: StageResult
) => void;

// ============================================================================
// WORKFLOW ENGINE
// ============================================================================

export class WorkflowEngine {
  private omgbuildDir: string;
  private executor: SkillExecutor;
  private memory: MemoryManager;
  private workflows: Map<string, Workflow> = new Map();

  constructor(
    omgbuildDir: string,
    executor: SkillExecutor,
    memory: MemoryManager
  ) {
    this.omgbuildDir = omgbuildDir;
    this.executor = executor;
    this.memory = memory;
  }

  /**
   * Initialize engine with available workflows
   */
  async initialize(): Promise<void> {
    const workflowsDir = path.join(this.omgbuildDir, 'workflows');
    if (await fs.pathExists(workflowsDir)) {
      const files = await fs.readdir(workflowsDir);
      for (const file of files) {
        if (file.endsWith('.yaml') || file.endsWith('.yml')) {
          const workflowPath = path.join(workflowsDir, file);
          const workflow = await parseWorkflow(workflowPath);
          this.workflows.set(workflow.name, workflow);
        }
      }
    }
  }

  /**
   * Get available workflows
   */
  getWorkflows(): string[] {
    return Array.from(this.workflows.keys());
  }

  /**
   * Get workflow details
   */
  getWorkflow(name: string): Workflow | undefined {
    return this.workflows.get(name);
  }

  /**
   * Execute a workflow
   */
  async execute(
    workflowName: string,
    description: string,
    options: {
      onStageStart?: ProgressCallback;
      onStageComplete?: ProgressCallback;
      onGate?: StageCallback;
      interactive?: boolean;
      startFromStage?: string;
    } = {}
  ): Promise<WorkflowResult> {
    const startTime = Date.now();
    const workflow = this.workflows.get(workflowName);
    
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowName}`);
    }

    // Create context
    const artifactsDir = path.join(
      this.omgbuildDir,
      'generated',
      `${workflowName}s`,
      `${Date.now()}`
    );
    await fs.ensureDir(artifactsDir);

    const context: WorkflowContext = {
      workflowName,
      description,
      startedAt: new Date(),
      status: 'running',
      currentStage: null,
      stageOutputs: new Map(),
      artifactsDir,
      userInputs: new Map(),
    };

    // Get stage execution order
    const stageOrder = getWorkflowStageOrder(workflow);
    const stageResults: StageResult[] = [];
    const allArtifacts: string[] = [];

    // Find starting point
    let startIndex = 0;
    if (options.startFromStage) {
      startIndex = stageOrder.indexOf(options.startFromStage);
      if (startIndex === -1) {
        throw new Error(`Stage not found: ${options.startFromStage}`);
      }
    }

    // Execute stages
    for (let i = startIndex; i < stageOrder.length; i++) {
      const stageId = stageOrder[i];
      const stage = workflow.stages.find(s => s.id === stageId);
      
      if (!stage) continue;

      context.currentStage = stageId;

      // Notify stage starting
      options.onStageStart?.(stage, 'starting');

      try {
        // Check gate if exists
        if (stage.gate && options.onGate) {
          const gateResult = await options.onGate(stage, context);
          if (!gateResult.proceed) {
            stageResults.push({
              stageId,
              success: false,
              skipped: true,
              skipReason: 'Gate not approved',
            });
            options.onStageComplete?.(stage, 'skipped');
            continue;
          }
          if (gateResult.input) {
            context.userInputs.set(stageId, gateResult.input);
          }
        }

        // Skip non-skill stages (like completion stages)
        if (!stage.skill) {
          stageResults.push({
            stageId,
            success: true,
            skipped: true,
            skipReason: 'No skill defined (completion stage)',
          });
          options.onStageComplete?.(stage, 'completed');
          continue;
        }

        // Build input for skill
        const skillInput = this.buildSkillInput(stage, context, description);

        // Execute skill
        const output = await this.executor.execute(stage.skill, skillInput);

        // Save artifacts
        const stageArtifactsDir = path.join(artifactsDir, stageId);
        const savedArtifacts = await this.executor.saveArtifacts(
          output.artifacts,
          stageArtifactsDir
        );
        allArtifacts.push(...savedArtifacts);

        // Save raw output
        const outputPath = path.join(stageArtifactsDir, 'output.md');
        await fs.ensureDir(stageArtifactsDir);
        await fs.writeFile(outputPath, output.content, 'utf-8');
        allArtifacts.push(outputPath);

        // Store output for next stages
        context.stageOutputs.set(stageId, output);

        stageResults.push({
          stageId,
          success: true,
          output,
        });

        options.onStageComplete?.(stage, 'completed', { stageId, success: true, output });

      } catch (error) {
        const errorMessage = (error as Error).message;
        
        stageResults.push({
          stageId,
          success: false,
          error: errorMessage,
        });

        options.onStageComplete?.(stage, 'failed', { stageId, success: false, error: errorMessage });

        // Stop workflow on failure
        context.status = 'failed';
        break;
      }
    }

    // Determine final status
    const allSuccessful = stageResults.every(r => r.success || r.skipped);
    if (context.status !== 'failed') {
      context.status = allSuccessful ? 'completed' : 'failed';
    }
    context.currentStage = null;

    // Save workflow execution record
    await this.saveExecutionRecord(context, stageResults);

    // Update memory
    if (workflow.memory?.store_decision) {
      await this.memory.saveDecision({
        title: `Workflow: ${workflowName} - ${description}`,
        context: `Executed ${workflow.name} workflow`,
        decision: context.status === 'completed' ? 'Completed successfully' : 'Failed',
        consequences: stageResults.map(r => 
          r.success ? `✅ ${r.stageId}` : `❌ ${r.stageId}: ${r.error || r.skipReason}`
        ),
      });
    }

    return {
      success: allSuccessful,
      context,
      stageResults,
      artifacts: allArtifacts,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Build skill input from stage configuration
   */
  private buildSkillInput(
    stage: WorkflowStage,
    context: WorkflowContext,
    description: string
  ): SkillInput {
    const input: SkillInput = {
      task: `${stage.name}: ${description}`,
      context: {},
    };

    // Add user input if available
    const userInput = context.userInputs.get(stage.id);
    if (userInput) {
      input.context!.userInput = userInput;
    }

    // Add outputs from dependent stages
    if (stage.depends_on) {
      for (const depId of stage.depends_on) {
        const depOutput = context.stageOutputs.get(depId);
        if (depOutput) {
          input.previousOutput = (input.previousOutput || '') + 
            `\n\n## Output from ${depId}:\n${depOutput.content}`;
        }
      }
    }

    // Add specific inputs from stage config
    if (stage.inputs) {
      for (const stageInput of stage.inputs) {
        if (stageInput.from_stage) {
          const output = context.stageOutputs.get(stageInput.from_stage);
          if (output) {
            input.context![stageInput.name || stageInput.from_stage] = output.content;
          }
        }
      }
    }

    return input;
  }

  /**
   * Save execution record
   */
  private async saveExecutionRecord(
    context: WorkflowContext,
    stageResults: StageResult[]
  ): Promise<void> {
    const yaml = await import('js-yaml');
    
    const record = {
      workflow: context.workflowName,
      description: context.description,
      status: context.status,
      startedAt: context.startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      stages: stageResults.map(r => ({
        id: r.stageId,
        success: r.success,
        skipped: r.skipped,
        skipReason: r.skipReason,
        error: r.error,
        model: r.output?.metadata.model,
        duration: r.output?.metadata.duration,
        tokens: r.output?.metadata.tokens,
      })),
    };

    const recordPath = path.join(context.artifactsDir, 'execution.yaml');
    await fs.writeFile(recordPath, yaml.dump(record), 'utf-8');
  }

  /**
   * Resume a paused workflow
   */
  async resume(
    executionDir: string,
    fromStage: string,
    options: {
      onStageStart?: ProgressCallback;
      onStageComplete?: ProgressCallback;
      onGate?: StageCallback;
    } = {}
  ): Promise<WorkflowResult> {
    const yaml = await import('js-yaml');
    
    // Load execution record
    const recordPath = path.join(executionDir, 'execution.yaml');
    const content = await fs.readFile(recordPath, 'utf-8');
    const record = yaml.load(content) as {
      workflow: string;
      description: string;
    };

    // Execute from the specified stage
    return this.execute(record.workflow, record.description, {
      ...options,
      startFromStage: fromStage,
    });
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export async function createWorkflowEngine(omgbuildDir: string): Promise<WorkflowEngine> {
  const executor = await createSkillExecutor(omgbuildDir);
  const memory = await createMemoryManager(omgbuildDir);
  
  const engine = new WorkflowEngine(omgbuildDir, executor, memory);
  await engine.initialize();
  
  return engine;
}
