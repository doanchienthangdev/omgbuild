/**
 * 🔮 OMGBUILD Phase 5 - Autonomous Runner
 * Runs development sprints autonomously with human oversight
 */

import { EventEmitter } from 'events';
import fs from 'fs-extra';
import path from 'path';
import readline from 'readline';
import { SprintManager, Sprint, Task, TaskStatus } from './sprint-manager';
import { TeamAgent, AgentRole, AGENT_PERSONAS, TeamDecision } from './team-agent';

// ============================================================================
// TYPES
// ============================================================================

export type AutoMode = 'full-auto' | 'semi-auto' | 'manual';

export interface AutoRunnerConfig {
  mode: AutoMode;
  maxTasksPerRun: number;
  pauseOnDecision: boolean;
  pauseOnError: boolean;
  autoApproveProposals: boolean;
  notifyOnComplete: boolean;
  workingDirectory: string;
}

export interface RunSession {
  id: string;
  startedAt: string;
  endedAt?: string;
  mode: AutoMode;
  tasksCompleted: number;
  tasksSkipped: number;
  tasksFailed: number;
  decisions: TeamDecision[];
  log: SessionLogEntry[];
}

export interface SessionLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  agent?: AgentRole;
  message: string;
}

export interface RunCallbacks {
  onStart?: (session: RunSession) => void;
  onTaskStart?: (task: Task) => void;
  onTaskComplete?: (task: Task, success: boolean) => void;
  onDecisionRequired?: (decision: TeamDecision) => Promise<boolean>;
  onAgentOutput?: (agent: AgentRole, chunk: string) => void;
  onLog?: (entry: SessionLogEntry) => void;
  onComplete?: (session: RunSession) => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// AUTONOMOUS RUNNER
// ============================================================================

export class AutonomousRunner extends EventEmitter {
  private sprintManager: SprintManager;
  private teamAgent: TeamAgent;
  private config: AutoRunnerConfig;
  private currentSession: RunSession | null = null;
  private isRunning: boolean = false;
  private shouldStop: boolean = false;

  constructor(
    sprintManager: SprintManager,
    teamAgent: TeamAgent,
    config?: Partial<AutoRunnerConfig>
  ) {
    super();
    this.sprintManager = sprintManager;
    this.teamAgent = teamAgent;
    this.config = {
      mode: 'semi-auto',
      maxTasksPerRun: 10,
      pauseOnDecision: true,
      pauseOnError: true,
      autoApproveProposals: false,
      notifyOnComplete: true,
      workingDirectory: process.cwd(),
      ...config,
    };

    // Wire up team agent events
    this.teamAgent.on('action:output', ({ action, chunk }) => {
      this.emit('agent:output', { agent: action.agentRole, chunk });
    });

    this.teamAgent.on('decision:created', (decision) => {
      this.emit('decision', decision);
    });
  }

  // ==========================================================================
  // SPRINT OPERATIONS
  // ==========================================================================

  /**
   * Start a new sprint with planning phase
   */
  async planSprint(options: {
    name?: string;
    goal?: string;
    duration?: number;
    generateProposals?: boolean;
  }): Promise<Sprint> {
    const vision = this.sprintManager.getVision();
    const sprintNumber = this.sprintManager.getSprints().length + 1;

    // Generate name and goal if not provided
    const name = options.name || `Sprint ${sprintNumber}`;
    const goal = options.goal || (vision?.goals[0] || 'Deliver value');

    this.log('info', `📋 Planning ${name}: "${goal}"`);

    // Generate proposals if requested
    if (options.generateProposals) {
      this.log('info', '🤖 Generating AI proposals...');
      
      const recentTasks = this.sprintManager.getBacklog().slice(-10);
      const proposals = await this.teamAgent.generateProposals({
        vision: vision?.description,
        recentTasks,
      });

      this.log('success', `Generated ${proposals.length} proposals`);
      
      for (const proposal of proposals) {
        this.log('info', `  📌 ${proposal.title} (${proposal.type}, ${proposal.priority})`);
      }
    }

    // Get backlog items for sprint
    const backlog = this.sprintManager.getBacklog({ status: 'backlog' });
    const velocityHistory = this.sprintManager.getVelocityHistory();
    const avgVelocity = velocityHistory.length > 0
      ? Math.round(velocityHistory.reduce((sum, v) => sum + v.velocity, 0) / velocityHistory.length)
      : 20;

    // Select tasks for sprint based on priority and velocity
    let pointsRemaining = avgVelocity;
    const selectedTasks: string[] = [];

    // Prioritize by priority then by creation date
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const sortedBacklog = [...backlog].sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    for (const task of sortedBacklog) {
      const points = task.storyPoints || 3;
      if (pointsRemaining >= points) {
        selectedTasks.push(task.id);
        pointsRemaining -= points;
      }
    }

    // Create sprint
    const sprint = await this.sprintManager.createSprint({
      name,
      goal,
      duration: options.duration,
      taskIds: selectedTasks,
    });

    this.log('success', `Created sprint with ${selectedTasks.length} tasks (${avgVelocity - pointsRemaining} points)`);

    return sprint;
  }

  /**
   * Run the current sprint
   */
  async runSprint(callbacks?: RunCallbacks): Promise<RunSession> {
    const sprint = this.sprintManager.getCurrentSprint();
    
    if (!sprint) {
      throw new Error('No active sprint. Start a sprint first with: omgbuild sprint start');
    }

    return this.run(callbacks);
  }

  /**
   * Run tasks autonomously
   */
  async run(callbacks?: RunCallbacks): Promise<RunSession> {
    if (this.isRunning) {
      throw new Error('Already running. Stop current session first.');
    }

    this.isRunning = true;
    this.shouldStop = false;

    // Create session
    this.currentSession = {
      id: `session-${Date.now()}`,
      startedAt: new Date().toISOString(),
      mode: this.config.mode,
      tasksCompleted: 0,
      tasksSkipped: 0,
      tasksFailed: 0,
      decisions: [],
      log: [],
    };

    callbacks?.onStart?.(this.currentSession);
    this.emit('session:start', this.currentSession);

    this.log('info', `🚀 Starting ${this.config.mode} run...`);

    try {
      // Get tasks to work on
      const sprint = this.sprintManager.getCurrentSprint();
      const tasks = sprint
        ? this.sprintManager.getBacklog({ sprintId: sprint.id })
            .filter(t => t.status === 'todo' || t.status === 'in-progress')
        : this.sprintManager.getBacklog({ status: 'backlog' })
            .slice(0, this.config.maxTasksPerRun);

      if (tasks.length === 0) {
        this.log('info', '✅ No tasks to work on');
      } else {
        this.log('info', `📋 ${tasks.length} tasks in queue`);
      }

      // Process tasks
      let taskCount = 0;
      for (const task of tasks) {
        if (this.shouldStop) {
          this.log('info', '⏹️ Run stopped by user');
          break;
        }

        if (taskCount >= this.config.maxTasksPerRun) {
          this.log('info', `⏸️ Reached max tasks per run (${this.config.maxTasksPerRun})`);
          break;
        }

        await this.processTask(task, callbacks);
        taskCount++;
      }

      // Summary
      this.log('success', `
📊 Run Complete:
   ✅ Completed: ${this.currentSession.tasksCompleted}
   ⏭️ Skipped: ${this.currentSession.tasksSkipped}
   ❌ Failed: ${this.currentSession.tasksFailed}
`);

    } catch (error) {
      this.log('error', `Run failed: ${(error as Error).message}`);
      callbacks?.onError?.(error as Error);
    } finally {
      this.currentSession.endedAt = new Date().toISOString();
      this.isRunning = false;
      callbacks?.onComplete?.(this.currentSession);
      this.emit('session:complete', this.currentSession);
    }

    return this.currentSession;
  }

  /**
   * Process a single task
   */
  private async processTask(task: Task, callbacks?: RunCallbacks): Promise<void> {
    this.log('info', `\n${'─'.repeat(60)}`);
    this.log('info', `📌 Task: ${task.title}`);
    this.log('info', `   Type: ${task.type} | Priority: ${task.priority}`);
    
    callbacks?.onTaskStart?.(task);
    this.emit('task:start', task);

    try {
      // Check dependencies
      if (task.dependencies?.length) {
        const deps = task.dependencies.map(id => this.sprintManager.getTask(id));
        const blocked = deps.some(d => d && d.status !== 'done');
        
        if (blocked) {
          this.log('warn', '   ⏸️ Blocked by dependencies');
          await this.sprintManager.updateTask(task.id, { status: 'blocked' });
          this.currentSession!.tasksSkipped++;
          return;
        }
      }

      // Execute with team agent
      const team = this.teamAgent.getTaskTeam(task);
      this.log('info', `   👥 Team: ${team.map(r => AGENT_PERSONAS[r].emoji).join(' ')}`);

      const result = await this.teamAgent.executeTask(task, {
        verbose: true,
      });

      if (result.success) {
        this.log('success', `   ✅ Completed`);
        await this.sprintManager.updateTask(task.id, { status: 'done' });
        this.currentSession!.tasksCompleted++;
        callbacks?.onTaskComplete?.(task, true);
      } else {
        this.log('error', `   ❌ Failed`);
        this.currentSession!.tasksFailed++;
        
        if (this.config.pauseOnError) {
          this.log('warn', '   ⏸️ Pausing due to error...');
          // In interactive mode, this would pause for user input
        }
        
        callbacks?.onTaskComplete?.(task, false);
      }

    } catch (error) {
      this.log('error', `   ❌ Error: ${(error as Error).message}`);
      this.currentSession!.tasksFailed++;
      callbacks?.onTaskComplete?.(task, false);
    }
  }

  /**
   * Stop the current run
   */
  stop(): void {
    this.shouldStop = true;
    this.log('info', '🛑 Stopping run...');
  }

  /**
   * Check if currently running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get current session
   */
  getSession(): RunSession | null {
    return this.currentSession;
  }

  // ==========================================================================
  // INTERACTIVE MODE
  // ==========================================================================

  /**
   * Run in interactive mode with user prompts
   */
  async runInteractive(): Promise<RunSession> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const ask = (question: string): Promise<string> => {
      return new Promise((resolve) => {
        rl.question(question, (answer) => {
          resolve(answer.trim());
        });
      });
    };

    const confirm = async (question: string): Promise<boolean> => {
      const answer = await ask(`${question} (y/n): `);
      return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
    };

    console.log(`
🔮 OMGBUILD Interactive Agent Mode
${'═'.repeat(50)}

Commands during run:
  p - Pause
  s - Skip current task
  q - Quit
`);

    try {
      return await this.run({
        onTaskStart: (task) => {
          console.log(`\n📌 Starting: ${task.title}`);
        },
        onAgentOutput: (agent, chunk) => {
          process.stdout.write(chunk);
        },
        onDecisionRequired: async (decision) => {
          console.log(`\n🔔 Decision Required: ${decision.description}`);
          console.log(`   Options: ${decision.options.join(', ')}`);
          return await confirm('Approve?');
        },
        onTaskComplete: (task, success) => {
          console.log(success ? '   ✅ Complete' : '   ❌ Failed');
        },
      });
    } finally {
      rl.close();
    }
  }

  // ==========================================================================
  // LOGGING
  // ==========================================================================

  private log(level: SessionLogEntry['level'], message: string, agent?: AgentRole): void {
    const entry: SessionLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      agent,
      message,
    };

    if (this.currentSession) {
      this.currentSession.log.push(entry);
    }

    this.emit('log', entry);

    // Console output with colors
    const prefix = {
      info: '  ',
      warn: '⚠️ ',
      error: '❌ ',
      success: '✅ ',
    }[level];

    console.log(`${prefix}${message}`);
  }

  // ==========================================================================
  // CONFIGURATION
  // ==========================================================================

  setMode(mode: AutoMode): void {
    this.config.mode = mode;
  }

  getConfig(): AutoRunnerConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<AutoRunnerConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createAutonomousRunner(
  sprintManager: SprintManager,
  teamAgent: TeamAgent,
  config?: Partial<AutoRunnerConfig>
): AutonomousRunner {
  return new AutonomousRunner(sprintManager, teamAgent, config);
}
