/**
 * 🔮 OMGBUILD Phase 5 - Sprint Manager
 * Agile sprint and backlog management for AI-driven development
 */

import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

export type TaskStatus = 'backlog' | 'todo' | 'in-progress' | 'review' | 'done' | 'blocked';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskType = 'feature' | 'bugfix' | 'refactor' | 'docs' | 'test' | 'devops' | 'research';
export type SprintStatus = 'planning' | 'active' | 'review' | 'completed';

export interface Task {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  storyPoints?: number;
  assignee?: string;  // Agent role
  labels?: string[];
  acceptanceCriteria?: string[];
  technicalNotes?: string;
  dependencies?: string[];  // Task IDs
  subtasks?: Subtask[];
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  sprintId?: string;
  source: 'user' | 'ai-proposal' | 'auto-detected';
  aiContext?: {
    analysisResult?: string;
    implementationPlan?: string;
    reviewFeedback?: string;
  };
}

export interface Subtask {
  id: string;
  title: string;
  status: 'todo' | 'done';
  assignee?: string;
}

export interface Sprint {
  id: string;
  name: string;
  goal: string;
  status: SprintStatus;
  startDate: string;
  endDate: string;
  tasks: string[];  // Task IDs
  velocity?: number;
  completedPoints?: number;
  retrospective?: {
    wentWell: string[];
    needsImprovement: string[];
    actionItems: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface ProductVision {
  name: string;
  description: string;
  goals: string[];
  targetUsers: string[];
  constraints?: string[];
  techStack?: string[];
  updatedAt: string;
}

export interface SprintConfig {
  defaultSprintDuration: number;  // days
  defaultVelocity: number;        // story points
  autoPropose: boolean;
  autoAssign: boolean;
  requireApproval: boolean;
  workingHours: {
    start: number;
    end: number;
  };
}

// ============================================================================
// SPRINT MANAGER
// ============================================================================

export class SprintManager {
  private omgbuildDir: string;
  private sprintDir: string;
  private backlog: Task[] = [];
  private sprints: Sprint[] = [];
  private currentSprint: Sprint | null = null;
  private vision: ProductVision | null = null;
  private config: SprintConfig;

  constructor(omgbuildDir: string) {
    this.omgbuildDir = omgbuildDir;
    this.sprintDir = path.join(omgbuildDir, 'sprints');
    this.config = {
      defaultSprintDuration: 14,
      defaultVelocity: 20,
      autoPropose: true,
      autoAssign: true,
      requireApproval: true,
      workingHours: { start: 9, end: 18 },
    };
  }

  /**
   * Initialize sprint management
   */
  async initialize(): Promise<void> {
    await fs.ensureDir(this.sprintDir);
    await fs.ensureDir(path.join(this.sprintDir, 'archive'));
    
    // Load existing data
    await this.loadBacklog();
    await this.loadSprints();
    await this.loadVision();
    await this.loadConfig();

    // Find current sprint
    this.currentSprint = this.sprints.find(s => s.status === 'active') || null;
  }

  // ==========================================================================
  // VISION MANAGEMENT
  // ==========================================================================

  /**
   * Set product vision
   */
  async setVision(vision: Omit<ProductVision, 'updatedAt'>): Promise<ProductVision> {
    this.vision = {
      ...vision,
      updatedAt: new Date().toISOString(),
    };

    await this.saveVision();
    return this.vision;
  }

  /**
   * Get product vision
   */
  getVision(): ProductVision | null {
    return this.vision;
  }

  // ==========================================================================
  // BACKLOG MANAGEMENT
  // ==========================================================================

  /**
   * Add task to backlog
   */
  async addTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<Task> {
    const newTask: Task = {
      ...task,
      id: `task-${uuidv4().slice(0, 8)}`,
      status: 'backlog',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.backlog.push(newTask);
    await this.saveBacklog();
    
    return newTask;
  }

  /**
   * Update task
   */
  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task | null> {
    const task = this.backlog.find(t => t.id === taskId);
    if (!task) return null;

    Object.assign(task, updates, { updatedAt: new Date().toISOString() });
    
    // Track status changes
    if (updates.status === 'in-progress' && !task.startedAt) {
      task.startedAt = new Date().toISOString();
    }
    if (updates.status === 'done' && !task.completedAt) {
      task.completedAt = new Date().toISOString();
    }

    await this.saveBacklog();
    return task;
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): Task | undefined {
    return this.backlog.find(t => t.id === taskId);
  }

  /**
   * Get all backlog tasks
   */
  getBacklog(filters?: {
    status?: TaskStatus;
    priority?: TaskPriority;
    type?: TaskType;
    sprintId?: string;
  }): Task[] {
    let tasks = [...this.backlog];

    if (filters) {
      if (filters.status) {
        tasks = tasks.filter(t => t.status === filters.status);
      }
      if (filters.priority) {
        tasks = tasks.filter(t => t.priority === filters.priority);
      }
      if (filters.type) {
        tasks = tasks.filter(t => t.type === filters.type);
      }
      if (filters.sprintId) {
        tasks = tasks.filter(t => t.sprintId === filters.sprintId);
      }
    }

    return tasks;
  }

  /**
   * Prioritize backlog
   */
  async prioritizeBacklog(taskIds: string[]): Promise<void> {
    const orderedTasks: Task[] = [];
    
    for (const id of taskIds) {
      const task = this.backlog.find(t => t.id === id);
      if (task) {
        orderedTasks.push(task);
      }
    }

    // Add remaining tasks
    for (const task of this.backlog) {
      if (!taskIds.includes(task.id)) {
        orderedTasks.push(task);
      }
    }

    this.backlog = orderedTasks;
    await this.saveBacklog();
  }

  // ==========================================================================
  // SPRINT MANAGEMENT
  // ==========================================================================

  /**
   * Create a new sprint
   */
  async createSprint(options: {
    name: string;
    goal: string;
    duration?: number;
    taskIds?: string[];
  }): Promise<Sprint> {
    const duration = options.duration || this.config.defaultSprintDuration;
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);

    const sprint: Sprint = {
      id: `sprint-${uuidv4().slice(0, 8)}`,
      name: options.name,
      goal: options.goal,
      status: 'planning',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      tasks: options.taskIds || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Assign tasks to sprint
    if (options.taskIds) {
      for (const taskId of options.taskIds) {
        const task = this.backlog.find(t => t.id === taskId);
        if (task) {
          task.sprintId = sprint.id;
          task.status = 'todo';
        }
      }
      await this.saveBacklog();
    }

    this.sprints.push(sprint);
    await this.saveSprints();

    return sprint;
  }

  /**
   * Start a sprint
   */
  async startSprint(sprintId: string): Promise<Sprint | null> {
    // End current sprint if active
    if (this.currentSprint) {
      await this.endSprint(this.currentSprint.id);
    }

    const sprint = this.sprints.find(s => s.id === sprintId);
    if (!sprint) return null;

    sprint.status = 'active';
    sprint.startDate = new Date().toISOString();
    sprint.updatedAt = new Date().toISOString();
    
    this.currentSprint = sprint;
    await this.saveSprints();

    return sprint;
  }

  /**
   * End a sprint
   */
  async endSprint(sprintId: string): Promise<Sprint | null> {
    const sprint = this.sprints.find(s => s.id === sprintId);
    if (!sprint) return null;

    sprint.status = 'completed';
    sprint.updatedAt = new Date().toISOString();

    // Calculate completed points
    const sprintTasks = this.backlog.filter(t => t.sprintId === sprintId);
    sprint.completedPoints = sprintTasks
      .filter(t => t.status === 'done')
      .reduce((sum, t) => sum + (t.storyPoints || 0), 0);

    // Move incomplete tasks back to backlog
    for (const task of sprintTasks) {
      if (task.status !== 'done') {
        task.sprintId = undefined;
        task.status = 'backlog';
      }
    }

    if (this.currentSprint?.id === sprintId) {
      this.currentSprint = null;
    }

    await this.saveBacklog();
    await this.saveSprints();

    return sprint;
  }

  /**
   * Get current sprint
   */
  getCurrentSprint(): Sprint | null {
    return this.currentSprint;
  }

  /**
   * Get all sprints
   */
  getSprints(): Sprint[] {
    return this.sprints;
  }

  /**
   * Get sprint by ID
   */
  getSprint(sprintId: string): Sprint | undefined {
    return this.sprints.find(s => s.id === sprintId);
  }

  /**
   * Add retrospective to sprint
   */
  async addRetrospective(sprintId: string, retro: Sprint['retrospective']): Promise<void> {
    const sprint = this.sprints.find(s => s.id === sprintId);
    if (sprint) {
      sprint.retrospective = retro;
      sprint.updatedAt = new Date().toISOString();
      await this.saveSprints();
    }
  }

  // ==========================================================================
  // SPRINT METRICS
  // ==========================================================================

  /**
   * Get sprint progress
   */
  getSprintProgress(sprintId?: string): {
    total: number;
    done: number;
    inProgress: number;
    todo: number;
    blocked: number;
    percentComplete: number;
    pointsTotal: number;
    pointsDone: number;
    daysRemaining: number;
  } {
    const sid = sprintId || this.currentSprint?.id;
    if (!sid) {
      return {
        total: 0, done: 0, inProgress: 0, todo: 0, blocked: 0,
        percentComplete: 0, pointsTotal: 0, pointsDone: 0, daysRemaining: 0,
      };
    }

    const sprint = this.sprints.find(s => s.id === sid);
    const tasks = this.backlog.filter(t => t.sprintId === sid);

    const done = tasks.filter(t => t.status === 'done').length;
    const inProgress = tasks.filter(t => t.status === 'in-progress').length;
    const todo = tasks.filter(t => t.status === 'todo').length;
    const blocked = tasks.filter(t => t.status === 'blocked').length;
    const total = tasks.length;

    const pointsTotal = tasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    const pointsDone = tasks
      .filter(t => t.status === 'done')
      .reduce((sum, t) => sum + (t.storyPoints || 0), 0);

    const daysRemaining = sprint
      ? Math.max(0, Math.ceil((new Date(sprint.endDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
      : 0;

    return {
      total,
      done,
      inProgress,
      todo,
      blocked,
      percentComplete: total > 0 ? Math.round((done / total) * 100) : 0,
      pointsTotal,
      pointsDone,
      daysRemaining,
    };
  }

  /**
   * Get velocity history
   */
  getVelocityHistory(count: number = 5): Array<{ sprintId: string; name: string; velocity: number }> {
    return this.sprints
      .filter(s => s.status === 'completed' && s.completedPoints !== undefined)
      .slice(-count)
      .map(s => ({
        sprintId: s.id,
        name: s.name,
        velocity: s.completedPoints || 0,
      }));
  }

  // ==========================================================================
  // PERSISTENCE
  // ==========================================================================

  private async loadBacklog(): Promise<void> {
    const backlogPath = path.join(this.sprintDir, 'backlog.yaml');
    if (await fs.pathExists(backlogPath)) {
      const content = await fs.readFile(backlogPath, 'utf-8');
      this.backlog = yaml.load(content) as Task[] || [];
    }
  }

  private async saveBacklog(): Promise<void> {
    const backlogPath = path.join(this.sprintDir, 'backlog.yaml');
    await fs.writeFile(backlogPath, yaml.dump(this.backlog), 'utf-8');
  }

  private async loadSprints(): Promise<void> {
    const sprintsPath = path.join(this.sprintDir, 'sprints.yaml');
    if (await fs.pathExists(sprintsPath)) {
      const content = await fs.readFile(sprintsPath, 'utf-8');
      this.sprints = yaml.load(content) as Sprint[] || [];
    }
  }

  private async saveSprints(): Promise<void> {
    const sprintsPath = path.join(this.sprintDir, 'sprints.yaml');
    await fs.writeFile(sprintsPath, yaml.dump(this.sprints), 'utf-8');
  }

  private async loadVision(): Promise<void> {
    const visionPath = path.join(this.sprintDir, 'vision.yaml');
    if (await fs.pathExists(visionPath)) {
      const content = await fs.readFile(visionPath, 'utf-8');
      this.vision = yaml.load(content) as ProductVision;
    }
  }

  private async saveVision(): Promise<void> {
    const visionPath = path.join(this.sprintDir, 'vision.yaml');
    await fs.writeFile(visionPath, yaml.dump(this.vision), 'utf-8');
  }

  private async loadConfig(): Promise<void> {
    const configPath = path.join(this.sprintDir, 'config.yaml');
    if (await fs.pathExists(configPath)) {
      const content = await fs.readFile(configPath, 'utf-8');
      this.config = { ...this.config, ...yaml.load(content) as Partial<SprintConfig> };
    }
  }

  async saveConfig(): Promise<void> {
    const configPath = path.join(this.sprintDir, 'config.yaml');
    await fs.writeFile(configPath, yaml.dump(this.config), 'utf-8');
  }

  getConfig(): SprintConfig {
    return this.config;
  }

  async updateConfig(updates: Partial<SprintConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    await this.saveConfig();
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export async function createSprintManager(omgbuildDir: string): Promise<SprintManager> {
  const manager = new SprintManager(omgbuildDir);
  await manager.initialize();
  return manager;
}
