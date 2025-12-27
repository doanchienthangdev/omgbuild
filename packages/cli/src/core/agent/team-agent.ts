/**
 * 🔮 OMGBUILD Phase 5 - Team Agent
 * AI Agents simulating a Big Tech development team
 */

import { EventEmitter } from 'events';
import { Task, Sprint, SprintManager, TaskType, TaskStatus } from './sprint-manager';
import { PipelineRunner, Pipeline, PipelineResult } from '../pipeline';
import { ToolRegistry, ExecutionContext, ExecutionResult, TaskType as ToolTaskType } from '../adapters';

// ============================================================================
// TYPES
// ============================================================================

export type AgentRole = 
  | 'tech-lead'
  | 'developer'
  | 'qa'
  | 'devops'
  | 'writer'
  | 'designer';

export interface AgentPersona {
  role: AgentRole;
  name: string;
  emoji: string;
  description: string;
  responsibilities: string[];
  skills: string[];
  taskTypes: TaskType[];
  systemPrompt: string;
}

export interface AgentAction {
  id: string;
  agentRole: AgentRole;
  taskId: string;
  action: string;
  input: string;
  output?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  toolUsed?: string;
}

export interface TeamDecision {
  id: string;
  type: 'architecture' | 'implementation' | 'priority' | 'release' | 'escalation';
  description: string;
  options: string[];
  selectedOption?: string;
  reasoning?: string;
  decidedBy: AgentRole;
  requiresApproval: boolean;
  approved?: boolean;
  createdAt: string;
  resolvedAt?: string;
}

export interface TeamStatus {
  activeAgents: AgentRole[];
  currentTask?: Task;
  progress: number;
  actions: AgentAction[];
  decisions: TeamDecision[];
  blockers: string[];
}

// ============================================================================
// AGENT PERSONAS
// ============================================================================

export const AGENT_PERSONAS: Record<AgentRole, AgentPersona> = {
  'tech-lead': {
    role: 'tech-lead',
    name: 'Alex (Tech Lead)',
    emoji: '👔',
    description: 'Senior technical leader responsible for architecture and code quality',
    responsibilities: [
      'Define technical architecture',
      'Code review and quality standards',
      'Technical decision making',
      'Mentoring and guidance',
      'Risk assessment',
    ],
    skills: ['architect', 'review', 'analyze'],
    taskTypes: ['feature', 'refactor', 'research'],
    systemPrompt: `You are Alex, a senior Tech Lead at a Big Tech company (Google/Meta/Amazon level).

Your approach:
- Think systematically about architecture and scalability
- Consider security, performance, and maintainability
- Make pragmatic decisions balancing ideal vs practical
- Provide clear technical guidance
- Review code with high standards but constructive feedback

Communication style:
- Direct and clear
- Technical but accessible
- Focus on "why" not just "what"
- Provide alternatives when rejecting ideas`,
  },

  'developer': {
    role: 'developer',
    name: 'Sam (Senior Developer)',
    emoji: '💻',
    description: 'Experienced full-stack developer focused on implementation',
    responsibilities: [
      'Implement features',
      'Write clean, maintainable code',
      'Debug and fix issues',
      'Refactor and optimize',
      'Write unit tests',
    ],
    skills: ['code', 'debug', 'refactor', 'test'],
    taskTypes: ['feature', 'bugfix', 'refactor'],
    systemPrompt: `You are Sam, a Senior Developer at a Big Tech company.

Your approach:
- Write clean, readable, well-documented code
- Follow SOLID principles and design patterns
- Think about edge cases and error handling
- Write tests alongside implementation
- Consider performance implications

Coding standards:
- Meaningful variable and function names
- Small, focused functions
- Proper error handling
- Comprehensive logging
- Self-documenting code`,
  },

  'qa': {
    role: 'qa',
    name: 'Jordan (QA Engineer)',
    emoji: '🧪',
    description: 'Quality assurance engineer ensuring product reliability',
    responsibilities: [
      'Design test strategies',
      'Write automated tests',
      'Security testing',
      'Performance testing',
      'Bug verification',
    ],
    skills: ['test', 'security', 'analyze'],
    taskTypes: ['test', 'bugfix'],
    systemPrompt: `You are Jordan, a QA Engineer at a Big Tech company.

Your approach:
- Think like a user AND an attacker
- Cover happy paths and edge cases
- Automate everything possible
- Security-first mindset
- Performance matters

Testing philosophy:
- Test pyramid: many unit, some integration, few E2E
- Every bug needs a regression test
- Test behavior, not implementation
- Clear test names that document expected behavior
- Mock external dependencies`,
  },

  'devops': {
    role: 'devops',
    name: 'Morgan (DevOps Engineer)',
    emoji: '🚀',
    description: 'DevOps engineer managing infrastructure and deployment',
    responsibilities: [
      'CI/CD pipeline management',
      'Infrastructure as code',
      'Monitoring and alerting',
      'Performance optimization',
      'Security hardening',
    ],
    skills: ['devops', 'security', 'performance'],
    taskTypes: ['devops'],
    systemPrompt: `You are Morgan, a DevOps Engineer at a Big Tech company.

Your approach:
- Automate everything
- Infrastructure as code
- Security by default
- Observability is key
- Fail fast, recover faster

DevOps principles:
- GitOps for deployments
- Blue-green or canary releases
- Comprehensive monitoring
- Automated rollbacks
- Cost optimization`,
  },

  'writer': {
    role: 'writer',
    name: 'Casey (Technical Writer)',
    emoji: '📝',
    description: 'Technical writer creating documentation and guides',
    responsibilities: [
      'API documentation',
      'User guides',
      'Architecture docs',
      'README files',
      'Release notes',
    ],
    skills: ['docs', 'analyze'],
    taskTypes: ['docs'],
    systemPrompt: `You are Casey, a Technical Writer at a Big Tech company.

Your approach:
- Clear, concise language
- User-focused documentation
- Examples for everything
- Keep docs up to date
- Multiple formats for different audiences

Writing standards:
- Active voice
- Short sentences
- Lots of code examples
- Visual diagrams where helpful
- Version-specific information`,
  },

  'designer': {
    role: 'designer',
    name: 'Riley (UX Designer)',
    emoji: '🎨',
    description: 'UX designer focusing on user experience and interface',
    responsibilities: [
      'UI/UX design',
      'User research insights',
      'Accessibility',
      'Design system',
      'Frontend implementation',
    ],
    skills: ['ux', 'frontend'],
    taskTypes: ['feature'],
    systemPrompt: `You are Riley, a UX Designer at a Big Tech company.

Your approach:
- User-centered design
- Accessibility first
- Consistent design language
- Mobile-first responsive
- Performance-conscious

Design principles:
- Clean, intuitive interfaces
- Consistent spacing and typography
- Accessible color contrast
- Clear visual hierarchy
- Meaningful animations`,
  },
};

// ============================================================================
// TEAM AGENT
// ============================================================================

export class TeamAgent extends EventEmitter {
  private sprintManager: SprintManager;
  private pipelineRunner: PipelineRunner;
  private toolRegistry: ToolRegistry;
  private actions: AgentAction[] = [];
  private decisions: TeamDecision[] = [];
  private isWorking: boolean = false;

  constructor(
    sprintManager: SprintManager,
    pipelineRunner: PipelineRunner,
    toolRegistry: ToolRegistry
  ) {
    super();
    this.sprintManager = sprintManager;
    this.pipelineRunner = pipelineRunner;
    this.toolRegistry = toolRegistry;
  }

  // ==========================================================================
  // TASK ASSIGNMENT
  // ==========================================================================

  /**
   * Get best agent for a task
   */
  getBestAgent(task: Task): AgentRole {
    // Map task types to primary agents
    const taskToAgent: Record<TaskType, AgentRole> = {
      feature: 'developer',
      bugfix: 'developer',
      refactor: 'tech-lead',
      docs: 'writer',
      test: 'qa',
      devops: 'devops',
      research: 'tech-lead',
    };

    return taskToAgent[task.type] || 'developer';
  }

  /**
   * Get agents involved in a task
   */
  getTaskTeam(task: Task): AgentRole[] {
    const team: AgentRole[] = [this.getBestAgent(task)];

    // Add supporting agents based on task type
    switch (task.type) {
      case 'feature':
        team.push('tech-lead', 'qa');
        if (task.labels?.includes('frontend')) {
          team.push('designer');
        }
        break;
      case 'bugfix':
        team.push('qa');
        break;
      case 'refactor':
        team.push('developer', 'qa');
        break;
      case 'devops':
        team.push('tech-lead');
        break;
    }

    // Remove duplicates
    return [...new Set(team)];
  }

  // ==========================================================================
  // TASK EXECUTION
  // ==========================================================================

  /**
   * Execute a task with the team
   */
  async executeTask(task: Task, options?: {
    interactive?: boolean;
    verbose?: boolean;
  }): Promise<{
    success: boolean;
    actions: AgentAction[];
    output: string;
    artifacts?: string[];
  }> {
    this.isWorking = true;
    const taskActions: AgentAction[] = [];
    let output = '';
    const artifacts: string[] = [];

    try {
      const team = this.getTaskTeam(task);
      const primaryAgent = this.getBestAgent(task);
      const persona = AGENT_PERSONAS[primaryAgent];

      this.emit('task:start', { task, team, primaryAgent });

      // Update task status
      await this.sprintManager.updateTask(task.id, { status: 'in-progress' });

      // Phase 1: Tech Lead Analysis (if feature or complex)
      if (task.type === 'feature' || task.type === 'refactor') {
        const analysisAction = await this.runAgentAction(
          'tech-lead',
          task,
          'analyze',
          `Analyze this ${task.type} request and create a technical plan:\n\n` +
          `Title: ${task.title}\n` +
          `Description: ${task.description}\n` +
          `Acceptance Criteria:\n${(task.acceptanceCriteria || []).map(c => `- ${c}`).join('\n')}\n\n` +
          `Provide:\n` +
          `1. Technical approach\n` +
          `2. Components affected\n` +
          `3. Potential risks\n` +
          `4. Implementation steps`
        );
        taskActions.push(analysisAction);
        
        if (analysisAction.status === 'completed') {
          task.aiContext = { ...task.aiContext, analysisResult: analysisAction.output };
          output += `\n## Tech Lead Analysis\n${analysisAction.output}\n`;
        }
      }

      // Phase 2: Implementation by Developer
      const implementAction = await this.runAgentAction(
        primaryAgent,
        task,
        'implement',
        this.buildImplementationPrompt(task, persona)
      );
      taskActions.push(implementAction);
      
      if (implementAction.status === 'completed') {
        task.aiContext = { ...task.aiContext, implementationPlan: implementAction.output };
        output += `\n## ${persona.name} Implementation\n${implementAction.output}\n`;
      }

      // Phase 3: QA Review (if not a docs task)
      if (task.type !== 'docs') {
        const qaAction = await this.runAgentAction(
          'qa',
          task,
          'review',
          `Review the implementation for quality and security:\n\n` +
          `Task: ${task.title}\n` +
          `Implementation:\n${implementAction.output?.slice(0, 2000)}...\n\n` +
          `Check for:\n` +
          `1. Code quality issues\n` +
          `2. Security vulnerabilities\n` +
          `3. Test coverage\n` +
          `4. Edge cases`
        );
        taskActions.push(qaAction);
        
        if (qaAction.status === 'completed') {
          task.aiContext = { ...task.aiContext, reviewFeedback: qaAction.output };
          output += `\n## QA Review\n${qaAction.output}\n`;
        }
      }

      // Update task
      await this.sprintManager.updateTask(task.id, {
        status: 'review',
        aiContext: task.aiContext,
      });

      this.actions.push(...taskActions);
      this.emit('task:complete', { task, actions: taskActions, output });

      return {
        success: true,
        actions: taskActions,
        output,
        artifacts,
      };
    } catch (error) {
      this.emit('task:error', { task, error });
      return {
        success: false,
        actions: taskActions,
        output: `Error: ${(error as Error).message}`,
      };
    } finally {
      this.isWorking = false;
    }
  }

  /**
   * Run a single agent action
   */
  private async runAgentAction(
    role: AgentRole,
    task: Task,
    actionType: string,
    prompt: string
  ): Promise<AgentAction> {
    const persona = AGENT_PERSONAS[role];
    const action: AgentAction = {
      id: `action-${Date.now()}`,
      agentRole: role,
      taskId: task.id,
      action: actionType,
      input: prompt,
      status: 'running',
      startedAt: new Date().toISOString(),
    };

    this.emit('action:start', { action, persona });

    try {
      // Find best tool for this action
      const toolTaskType = this.mapToToolTaskType(actionType);
      const tool = await this.toolRegistry.findBestTool(toolTaskType);

      if (!tool) {
        throw new Error(`No available tool for action: ${actionType}`);
      }

      // Build context with persona
      const context: ExecutionContext = {
        task: `${persona.systemPrompt}\n\n---\n\n${prompt}`,
        taskType: toolTaskType,
        projectRoot: process.cwd(),
        omgbuildDir: process.cwd() + '/.omgbuild',
        metadata: {
          agentRole: role,
          taskId: task.id,
        },
      };

      // Execute
      const result = await tool.execute(context, {
        onOutput: (chunk) => this.emit('action:output', { action, chunk }),
      });

      action.output = result.output;
      action.status = result.success ? 'completed' : 'failed';
      action.completedAt = new Date().toISOString();
      action.duration = result.duration;
      action.toolUsed = result.toolUsed;

    } catch (error) {
      action.status = 'failed';
      action.output = (error as Error).message;
      action.completedAt = new Date().toISOString();
    }

    this.emit('action:complete', { action });
    return action;
  }

  /**
   * Map action types to tool task types
   */
  private mapToToolTaskType(actionType: string): ToolTaskType {
    const mapping: Record<string, ToolTaskType> = {
      analyze: 'analyze',
      implement: 'code',
      review: 'review',
      test: 'test',
      document: 'document',
      debug: 'debug',
      refactor: 'refactor',
    };
    return mapping[actionType] || 'code';
  }

  /**
   * Build implementation prompt for an agent
   */
  private buildImplementationPrompt(task: Task, persona: AgentPersona): string {
    let prompt = `As ${persona.name}, implement the following:\n\n`;
    prompt += `**Task:** ${task.title}\n\n`;
    prompt += `**Description:** ${task.description}\n\n`;

    if (task.acceptanceCriteria?.length) {
      prompt += `**Acceptance Criteria:**\n`;
      task.acceptanceCriteria.forEach((c, i) => {
        prompt += `${i + 1}. ${c}\n`;
      });
      prompt += '\n';
    }

    if (task.technicalNotes) {
      prompt += `**Technical Notes:** ${task.technicalNotes}\n\n`;
    }

    if (task.aiContext?.analysisResult) {
      prompt += `**Tech Lead Analysis:**\n${task.aiContext.analysisResult}\n\n`;
    }

    prompt += `\nProvide a complete implementation following Big Tech standards.`;

    return prompt;
  }

  // ==========================================================================
  // PROPOSALS
  // ==========================================================================

  /**
   * Generate feature proposals based on project analysis
   */
  async generateProposals(context: {
    vision?: string;
    recentTasks?: Task[];
    codebaseAnalysis?: string;
  }): Promise<Task[]> {
    const proposals: Task[] = [];

    const prompt = `As a Tech Lead, analyze the project and propose valuable features or improvements.

${context.vision ? `**Product Vision:** ${context.vision}` : ''}

${context.codebaseAnalysis ? `**Codebase Analysis:** ${context.codebaseAnalysis}` : ''}

${context.recentTasks?.length ? `**Recent Work:**\n${context.recentTasks.map(t => `- ${t.title}`).join('\n')}` : ''}

Propose 3-5 high-value items considering:
1. User impact
2. Technical debt reduction
3. Performance improvements
4. Security enhancements
5. Developer experience

Format each as:
- Title: [title]
- Type: [feature|bugfix|refactor|test|devops|docs]
- Priority: [critical|high|medium|low]
- Description: [description]
- Story Points: [1-13]
- Acceptance Criteria:
  - [criterion 1]
  - [criterion 2]`;

    const tool = await this.toolRegistry.findBestTool('analyze');
    if (!tool) return proposals;

    try {
      const result = await tool.execute({
        task: prompt,
        taskType: 'analyze',
        projectRoot: process.cwd(),
        omgbuildDir: process.cwd() + '/.omgbuild',
      });

      if (result.success) {
        // Parse proposals from output
        const parsed = this.parseProposals(result.output);
        for (const p of parsed) {
          const task = await this.sprintManager.addTask({
            ...p,
            source: 'ai-proposal',
          });
          proposals.push(task);
        }
      }
    } catch (error) {
      this.emit('error', { message: 'Failed to generate proposals', error });
    }

    return proposals;
  }

  /**
   * Parse proposals from AI output
   */
  private parseProposals(output: string): Array<Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'status'>> {
    const proposals: Array<Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'status'>> = [];
    
    // Split by proposal markers
    const sections = output.split(/(?=- Title:|Title:)/i).filter(s => s.trim());

    for (const section of sections) {
      try {
        const title = section.match(/Title:\s*(.+)/i)?.[1]?.trim();
        const type = section.match(/Type:\s*(\w+)/i)?.[1]?.toLowerCase() as TaskType;
        const priority = section.match(/Priority:\s*(\w+)/i)?.[1]?.toLowerCase() as any;
        const description = section.match(/Description:\s*(.+?)(?=\n|Story|Acceptance)/is)?.[1]?.trim();
        const points = parseInt(section.match(/Story Points:\s*(\d+)/i)?.[1] || '3');
        
        // Extract acceptance criteria
        const criteriaMatch = section.match(/Acceptance Criteria:[\s\S]*?(?=\n\n|$)/i);
        const criteria = criteriaMatch?.[0]
          .split('\n')
          .filter(l => l.trim().startsWith('-'))
          .map(l => l.replace(/^-\s*/, '').trim())
          .filter(Boolean);

        if (title && type && description) {
          proposals.push({
            title,
            type: type || 'feature',
            priority: priority || 'medium',
            description,
            storyPoints: points,
            acceptanceCriteria: criteria || [],
            source: 'ai-proposal',
          });
        }
      } catch {
        // Skip malformed proposals
      }
    }

    return proposals;
  }

  // ==========================================================================
  // TEAM STATUS
  // ==========================================================================

  /**
   * Get current team status
   */
  getStatus(): TeamStatus {
    const currentSprint = this.sprintManager.getCurrentSprint();
    const currentTask = currentSprint
      ? this.sprintManager.getBacklog({ sprintId: currentSprint.id, status: 'in-progress' })[0]
      : undefined;

    return {
      activeAgents: this.isWorking ? [this.getBestAgent(currentTask!)] : [],
      currentTask,
      progress: currentSprint
        ? this.sprintManager.getSprintProgress(currentSprint.id).percentComplete
        : 0,
      actions: this.actions.slice(-20),
      decisions: this.decisions.slice(-10),
      blockers: this.getBlockers(),
    };
  }

  /**
   * Get current blockers
   */
  private getBlockers(): string[] {
    const blockers: string[] = [];
    
    // Check for blocked tasks
    const blockedTasks = this.sprintManager.getBacklog({ status: 'blocked' });
    for (const task of blockedTasks) {
      blockers.push(`Task blocked: ${task.title}`);
    }

    // Check for pending decisions
    const pendingDecisions = this.decisions.filter(d => d.requiresApproval && !d.approved);
    for (const decision of pendingDecisions) {
      blockers.push(`Awaiting approval: ${decision.description}`);
    }

    return blockers;
  }

  /**
   * Create a decision that may require approval
   */
  async createDecision(decision: Omit<TeamDecision, 'id' | 'createdAt'>): Promise<TeamDecision> {
    const newDecision: TeamDecision = {
      ...decision,
      id: `decision-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    this.decisions.push(newDecision);
    this.emit('decision:created', newDecision);

    return newDecision;
  }

  /**
   * Approve a decision
   */
  approveDecision(decisionId: string, approved: boolean, reasoning?: string): void {
    const decision = this.decisions.find(d => d.id === decisionId);
    if (decision) {
      decision.approved = approved;
      decision.reasoning = reasoning;
      decision.resolvedAt = new Date().toISOString();
      this.emit('decision:resolved', decision);
    }
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export async function createTeamAgent(
  sprintManager: SprintManager,
  pipelineRunner: PipelineRunner,
  toolRegistry: ToolRegistry
): Promise<TeamAgent> {
  return new TeamAgent(sprintManager, pipelineRunner, toolRegistry);
}
