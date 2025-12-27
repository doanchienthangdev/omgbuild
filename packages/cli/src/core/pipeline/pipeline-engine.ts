/**
 * 🔮 OMGBUILD Pipeline Engine
 * Compose and execute multi-step pipelines with tool orchestration
 */

import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';
import { EventEmitter } from 'events';
import { 
  ToolRegistry, 
  BaseToolAdapter, 
  ExecutionContext, 
  ExecutionResult,
  TaskType 
} from '../adapters';

// ============================================================================
// TYPES
// ============================================================================

export interface PipelineStep {
  id: string;
  name: string;
  description?: string;
  tool?: string;              // Specific tool to use (optional - will auto-route if not specified)
  skill?: string;             // OMGBUILD skill to apply
  task: string;               // The task/prompt
  taskType?: TaskType;        // Task type for routing
  files?: string[];           // Files to include in context
  dependsOn?: string[];       // Step dependencies
  condition?: string;         // Condition to run (e.g., "previous.success")
  retry?: {
    maxAttempts: number;
    delay: number;
  };
  timeout?: number;
  onSuccess?: string;         // Next step on success
  onFailure?: string;         // Step to run on failure
  gate?: {                    // Human gate
    enabled: boolean;
    message?: string;
  };
  env?: Record<string, string>;
  outputs?: string[];         // Named outputs to capture
}

export interface Pipeline {
  name: string;
  description?: string;
  version?: string;
  author?: string;
  tags?: string[];
  variables?: Record<string, string>;
  env?: Record<string, string>;
  steps: PipelineStep[];
  onSuccess?: string;
  onFailure?: string;
  timeout?: number;
}

export interface PipelineContext {
  projectRoot: string;
  omgbuildDir: string;
  variables: Record<string, string>;
  env: Record<string, string>;
  stepResults: Map<string, StepResult>;
  memory?: {
    decisions: unknown[];
    patterns: unknown[];
    learnings: unknown[];
  };
}

export interface StepResult {
  stepId: string;
  success: boolean;
  output: string;
  error?: string;
  duration: number;
  toolUsed: string;
  artifacts?: {
    files: string[];
    code: string[];
  };
  skipped?: boolean;
  skipReason?: string;
}

export interface PipelineResult {
  pipelineName: string;
  success: boolean;
  totalDuration: number;
  stepResults: StepResult[];
  error?: string;
  artifacts: {
    files: string[];
    code: string[];
  };
}

export interface PipelineCallbacks {
  onPipelineStart?: (pipeline: Pipeline) => void;
  onStepStart?: (step: PipelineStep, index: number) => void;
  onStepOutput?: (stepId: string, chunk: string) => void;
  onStepComplete?: (result: StepResult) => void;
  onGate?: (step: PipelineStep) => Promise<boolean>;
  onPipelineComplete?: (result: PipelineResult) => void;
  onError?: (error: Error, step?: PipelineStep) => void;
}

// ============================================================================
// PIPELINE PARSER
// ============================================================================

export class PipelineParser {
  /**
   * Parse pipeline from YAML file
   */
  static async fromFile(filePath: string): Promise<Pipeline> {
    const content = await fs.readFile(filePath, 'utf-8');
    return this.fromYAML(content);
  }

  /**
   * Parse pipeline from YAML string
   */
  static fromYAML(content: string): Pipeline {
    const data = yaml.load(content) as Pipeline;
    return this.validate(data);
  }

  /**
   * Validate pipeline structure
   */
  static validate(pipeline: Pipeline): Pipeline {
    if (!pipeline.name) {
      throw new Error('Pipeline must have a name');
    }

    if (!pipeline.steps || pipeline.steps.length === 0) {
      throw new Error('Pipeline must have at least one step');
    }

    // Validate steps
    const stepIds = new Set<string>();
    for (let i = 0; i < pipeline.steps.length; i++) {
      const step = pipeline.steps[i];
      
      // Generate ID if not provided
      if (!step.id) {
        step.id = `step-${i + 1}`;
      }

      // Check for duplicate IDs
      if (stepIds.has(step.id)) {
        throw new Error(`Duplicate step ID: ${step.id}`);
      }
      stepIds.add(step.id);

      // Validate required fields
      if (!step.name) {
        step.name = step.id;
      }

      if (!step.task) {
        throw new Error(`Step ${step.id} must have a task`);
      }

      // Validate dependencies
      if (step.dependsOn) {
        for (const dep of step.dependsOn) {
          if (!stepIds.has(dep) && !pipeline.steps.some(s => s.id === dep)) {
            throw new Error(`Step ${step.id} depends on unknown step: ${dep}`);
          }
        }
      }
    }

    return pipeline;
  }

  /**
   * Serialize pipeline to YAML
   */
  static toYAML(pipeline: Pipeline): string {
    return yaml.dump(pipeline, { lineWidth: -1 });
  }
}

// ============================================================================
// STEP EXECUTOR
// ============================================================================

export class StepExecutor {
  private registry: ToolRegistry;

  constructor(registry: ToolRegistry) {
    this.registry = registry;
  }

  /**
   * Execute a single step
   */
  async execute(
    step: PipelineStep,
    context: PipelineContext,
    callbacks?: PipelineCallbacks
  ): Promise<StepResult> {
    const startTime = Date.now();

    // Check condition
    if (step.condition && !this.evaluateCondition(step.condition, context)) {
      return {
        stepId: step.id,
        success: true,
        output: '',
        duration: 0,
        toolUsed: 'none',
        skipped: true,
        skipReason: `Condition not met: ${step.condition}`,
      };
    }

    // Find the right tool
    let tool: BaseToolAdapter | null = null;

    if (step.tool) {
      // Use specified tool
      tool = this.registry.get(step.tool) || null;
      if (!tool) {
        return {
          stepId: step.id,
          success: false,
          output: '',
          error: `Tool not found: ${step.tool}`,
          duration: Date.now() - startTime,
          toolUsed: step.tool,
        };
      }
    } else {
      // Auto-route based on task type
      const taskType = step.taskType || this.inferTaskType(step.task);
      tool = await this.registry.findBestTool(taskType);
      
      if (!tool) {
        return {
          stepId: step.id,
          success: false,
          output: '',
          error: `No available tool for task type: ${taskType}`,
          duration: Date.now() - startTime,
          toolUsed: 'none',
        };
      }
    }

    // Build execution context
    const execContext: ExecutionContext = {
      task: this.interpolate(step.task, context),
      taskType: step.taskType || this.inferTaskType(step.task),
      projectRoot: context.projectRoot,
      omgbuildDir: context.omgbuildDir,
      files: step.files?.map(f => this.interpolate(f, context)),
      previousOutput: this.getPreviousOutput(step, context),
      memory: context.memory,
      metadata: {
        stepId: step.id,
        skill: step.skill,
      },
    };

    // Execute with retry logic
    let lastError: string | undefined;
    const maxAttempts = step.retry?.maxAttempts || 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await tool.execute(execContext, {
          onOutput: (chunk) => callbacks?.onStepOutput?.(step.id, chunk),
        });

        if (result.success) {
          return {
            stepId: step.id,
            success: true,
            output: result.output,
            duration: result.duration,
            toolUsed: result.toolUsed,
            artifacts: result.artifacts,
          };
        }

        lastError = result.error;

        // Delay before retry
        if (attempt < maxAttempts && step.retry?.delay) {
          await this.delay(step.retry.delay);
        }
      } catch (error) {
        lastError = (error as Error).message;
      }
    }

    return {
      stepId: step.id,
      success: false,
      output: '',
      error: lastError || 'Unknown error',
      duration: Date.now() - startTime,
      toolUsed: tool.name,
    };
  }

  /**
   * Infer task type from task description
   */
  private inferTaskType(task: string): TaskType {
    const taskLower = task.toLowerCase();

    if (taskLower.includes('analyze') || taskLower.includes('review')) {
      return 'analyze';
    }
    if (taskLower.includes('test') || taskLower.includes('spec')) {
      return 'test';
    }
    if (taskLower.includes('refactor') || taskLower.includes('cleanup')) {
      return 'refactor';
    }
    if (taskLower.includes('debug') || taskLower.includes('fix bug')) {
      return 'debug';
    }
    if (taskLower.includes('document') || taskLower.includes('readme')) {
      return 'document';
    }
    if (taskLower.includes('explain') || taskLower.includes('what is')) {
      return 'explain';
    }
    if (taskLower.includes('implement') || taskLower.includes('create') || taskLower.includes('add')) {
      return 'code';
    }

    return 'code'; // Default to code
  }

  /**
   * Evaluate a condition string
   */
  private evaluateCondition(condition: string, context: PipelineContext): boolean {
    // Simple condition evaluation
    // Supports: "previous.success", "step.xxx.success", "env.XXX == 'value'"
    
    if (condition === 'always') return true;
    if (condition === 'never') return false;

    // Check previous step success
    if (condition === 'previous.success') {
      const results = Array.from(context.stepResults.values());
      const lastResult = results[results.length - 1];
      return lastResult?.success ?? true;
    }

    // Check specific step success
    const stepMatch = condition.match(/^step\.(\w+)\.success$/);
    if (stepMatch) {
      const stepResult = context.stepResults.get(stepMatch[1]);
      return stepResult?.success ?? false;
    }

    // Environment variable check
    const envMatch = condition.match(/^env\.(\w+)\s*==\s*['"](.+)['"]$/);
    if (envMatch) {
      return context.env[envMatch[1]] === envMatch[2];
    }

    return true;
  }

  /**
   * Get output from previous step(s)
   */
  private getPreviousOutput(step: PipelineStep, context: PipelineContext): string | undefined {
    if (step.dependsOn && step.dependsOn.length > 0) {
      const outputs: string[] = [];
      for (const depId of step.dependsOn) {
        const result = context.stepResults.get(depId);
        if (result?.output) {
          outputs.push(`[${depId}]:\n${result.output}`);
        }
      }
      return outputs.length > 0 ? outputs.join('\n\n') : undefined;
    }

    // Get last step output
    const results = Array.from(context.stepResults.values());
    const lastResult = results[results.length - 1];
    return lastResult?.output;
  }

  /**
   * Interpolate variables in string
   */
  private interpolate(str: string, context: PipelineContext): string {
    return str.replace(/\$\{(\w+)\}/g, (_, key) => {
      return context.variables[key] || context.env[key] || '';
    });
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// PIPELINE RUNNER
// ============================================================================

export class PipelineRunner extends EventEmitter {
  private registry: ToolRegistry;
  private executor: StepExecutor;

  constructor(registry: ToolRegistry) {
    super();
    this.registry = registry;
    this.executor = new StepExecutor(registry);
  }

  /**
   * Run a pipeline
   */
  async run(
    pipeline: Pipeline,
    baseContext: {
      projectRoot: string;
      omgbuildDir: string;
      variables?: Record<string, string>;
      memory?: PipelineContext['memory'];
    },
    callbacks?: PipelineCallbacks
  ): Promise<PipelineResult> {
    const startTime = Date.now();

    // Initialize context
    const context: PipelineContext = {
      projectRoot: baseContext.projectRoot,
      omgbuildDir: baseContext.omgbuildDir,
      variables: {
        ...pipeline.variables,
        ...baseContext.variables,
      },
      env: {
        ...process.env as Record<string, string>,
        ...pipeline.env,
      },
      stepResults: new Map(),
      memory: baseContext.memory,
    };

    callbacks?.onPipelineStart?.(pipeline);
    this.emit('start', pipeline);

    const allArtifacts = {
      files: [] as string[],
      code: [] as string[],
    };

    // Sort steps by dependencies (topological sort)
    const orderedSteps = this.topologicalSort(pipeline.steps);

    // Execute steps
    for (let i = 0; i < orderedSteps.length; i++) {
      const step = orderedSteps[i];

      // Handle gate
      if (step.gate?.enabled) {
        const shouldContinue = await callbacks?.onGate?.(step);
        if (!shouldContinue) {
          return {
            pipelineName: pipeline.name,
            success: false,
            totalDuration: Date.now() - startTime,
            stepResults: Array.from(context.stepResults.values()),
            error: `Pipeline stopped at gate: ${step.name}`,
            artifacts: allArtifacts,
          };
        }
      }

      callbacks?.onStepStart?.(step, i);
      this.emit('step:start', step, i);

      const result = await this.executor.execute(step, context, callbacks);
      context.stepResults.set(step.id, result);

      callbacks?.onStepComplete?.(result);
      this.emit('step:complete', result);

      // Collect artifacts
      if (result.artifacts) {
        allArtifacts.files.push(...result.artifacts.files);
        allArtifacts.code.push(...result.artifacts.code);
      }

      // Handle failure
      if (!result.success && !result.skipped) {
        // Check for onFailure handler
        if (step.onFailure) {
          const failureStep = pipeline.steps.find(s => s.id === step.onFailure);
          if (failureStep) {
            await this.executor.execute(failureStep, context, callbacks);
          }
        }

        // If no failure handler or critical failure, stop pipeline
        if (!step.onFailure) {
          return {
            pipelineName: pipeline.name,
            success: false,
            totalDuration: Date.now() - startTime,
            stepResults: Array.from(context.stepResults.values()),
            error: `Step ${step.id} failed: ${result.error}`,
            artifacts: allArtifacts,
          };
        }
      }
    }

    const pipelineResult: PipelineResult = {
      pipelineName: pipeline.name,
      success: true,
      totalDuration: Date.now() - startTime,
      stepResults: Array.from(context.stepResults.values()),
      artifacts: allArtifacts,
    };

    callbacks?.onPipelineComplete?.(pipelineResult);
    this.emit('complete', pipelineResult);

    return pipelineResult;
  }

  /**
   * Topological sort of steps based on dependencies
   */
  private topologicalSort(steps: PipelineStep[]): PipelineStep[] {
    const sorted: PipelineStep[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (step: PipelineStep) => {
      if (visited.has(step.id)) return;
      if (visiting.has(step.id)) {
        throw new Error(`Circular dependency detected at step: ${step.id}`);
      }

      visiting.add(step.id);

      // Visit dependencies first
      if (step.dependsOn) {
        for (const depId of step.dependsOn) {
          const depStep = steps.find(s => s.id === depId);
          if (depStep) {
            visit(depStep);
          }
        }
      }

      visiting.delete(step.id);
      visited.add(step.id);
      sorted.push(step);
    };

    for (const step of steps) {
      visit(step);
    }

    return sorted;
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export async function createPipelineRunner(
  registry?: ToolRegistry
): Promise<PipelineRunner> {
  if (!registry) {
    const { createDefaultRegistry } = await import('../adapters');
    registry = await createDefaultRegistry();
  }
  return new PipelineRunner(registry);
}
