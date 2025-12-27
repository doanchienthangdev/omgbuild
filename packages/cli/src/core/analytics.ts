/**
 * 🔮 OMGBUILD Analytics Module
 * Track productivity metrics and AI usage
 */

import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';

// ============================================================================
// TYPES
// ============================================================================

export interface SkillUsage {
  skill: string;
  count: number;
  totalDuration: number;
  avgDuration: number;
  totalTokens: number;
  successRate: number;
  lastUsed: string;
}

export interface WorkflowUsage {
  workflow: string;
  count: number;
  completedCount: number;
  avgDuration: number;
  avgStages: number;
  lastRun: string;
}

export interface DailyMetrics {
  date: string;
  skillRuns: number;
  workflowRuns: number;
  tokensUsed: number;
  timeSpent: number;
  artifactsGenerated: number;
  decisionsRecorded: number;
}

export interface ProjectMetrics {
  totalSkillRuns: number;
  totalWorkflowRuns: number;
  totalTokensUsed: number;
  totalTimeSpent: number;
  totalArtifacts: number;
  totalDecisions: number;
  avgSessionDuration: number;
  mostUsedSkill: string | null;
  mostUsedWorkflow: string | null;
  projectStarted: string;
  lastActivity: string;
}

export interface UsageEvent {
  id: string;
  type: 'skill' | 'workflow' | 'chat';
  name: string;
  timestamp: string;
  duration: number;
  tokensIn: number;
  tokensOut: number;
  success: boolean;
  model: string;
  artifacts: number;
  error?: string;
}

// ============================================================================
// ANALYTICS MANAGER
// ============================================================================

export class AnalyticsManager {
  private omgbuildDir: string;
  private analyticsDir: string;
  private events: UsageEvent[] = [];
  private dailyMetrics: Map<string, DailyMetrics> = new Map();

  constructor(omgbuildDir: string) {
    this.omgbuildDir = omgbuildDir;
    this.analyticsDir = path.join(omgbuildDir, 'analytics');
  }

  /**
   * Initialize analytics
   */
  async initialize(): Promise<void> {
    await fs.ensureDir(this.analyticsDir);
    await this.loadEvents();
    await this.loadDailyMetrics();
  }

  /**
   * Load events from disk
   */
  private async loadEvents(): Promise<void> {
    const eventsPath = path.join(this.analyticsDir, 'events.yaml');
    
    if (await fs.pathExists(eventsPath)) {
      const content = await fs.readFile(eventsPath, 'utf-8');
      const data = yaml.load(content) as { events?: UsageEvent[] };
      this.events = data.events || [];
    }
  }

  /**
   * Load daily metrics
   */
  private async loadDailyMetrics(): Promise<void> {
    const metricsPath = path.join(this.analyticsDir, 'daily-metrics.yaml');
    
    if (await fs.pathExists(metricsPath)) {
      const content = await fs.readFile(metricsPath, 'utf-8');
      const data = yaml.load(content) as { metrics?: DailyMetrics[] };
      
      for (const metric of data.metrics || []) {
        this.dailyMetrics.set(metric.date, metric);
      }
    }
  }

  /**
   * Save events to disk
   */
  private async saveEvents(): Promise<void> {
    const eventsPath = path.join(this.analyticsDir, 'events.yaml');
    
    // Keep only last 1000 events
    const recentEvents = this.events.slice(-1000);
    
    await fs.writeFile(
      eventsPath,
      yaml.dump({ events: recentEvents }),
      'utf-8'
    );
  }

  /**
   * Save daily metrics
   */
  private async saveDailyMetrics(): Promise<void> {
    const metricsPath = path.join(this.analyticsDir, 'daily-metrics.yaml');
    
    await fs.writeFile(
      metricsPath,
      yaml.dump({ metrics: Array.from(this.dailyMetrics.values()) }),
      'utf-8'
    );
  }

  /**
   * Record a usage event
   */
  async recordEvent(event: Omit<UsageEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: UsageEvent = {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      ...event,
    };

    this.events.push(fullEvent);

    // Update daily metrics
    await this.updateDailyMetrics(fullEvent);

    // Save
    await this.saveEvents();
  }

  /**
   * Update daily metrics
   */
  private async updateDailyMetrics(event: UsageEvent): Promise<void> {
    const date = event.timestamp.split('T')[0];
    
    let metrics = this.dailyMetrics.get(date);
    if (!metrics) {
      metrics = {
        date,
        skillRuns: 0,
        workflowRuns: 0,
        tokensUsed: 0,
        timeSpent: 0,
        artifactsGenerated: 0,
        decisionsRecorded: 0,
      };
    }

    if (event.type === 'skill') {
      metrics.skillRuns++;
    } else if (event.type === 'workflow') {
      metrics.workflowRuns++;
    }

    metrics.tokensUsed += event.tokensIn + event.tokensOut;
    metrics.timeSpent += event.duration;
    metrics.artifactsGenerated += event.artifacts;

    this.dailyMetrics.set(date, metrics);
    await this.saveDailyMetrics();
  }

  /**
   * Get skill usage statistics
   */
  getSkillUsage(): SkillUsage[] {
    const usageMap = new Map<string, {
      count: number;
      totalDuration: number;
      totalTokens: number;
      successCount: number;
      lastUsed: string;
    }>();

    for (const event of this.events) {
      if (event.type !== 'skill') continue;

      const existing = usageMap.get(event.name) || {
        count: 0,
        totalDuration: 0,
        totalTokens: 0,
        successCount: 0,
        lastUsed: '',
      };

      existing.count++;
      existing.totalDuration += event.duration;
      existing.totalTokens += event.tokensIn + event.tokensOut;
      if (event.success) existing.successCount++;
      if (event.timestamp > existing.lastUsed) {
        existing.lastUsed = event.timestamp;
      }

      usageMap.set(event.name, existing);
    }

    return Array.from(usageMap.entries()).map(([skill, data]) => ({
      skill,
      count: data.count,
      totalDuration: data.totalDuration,
      avgDuration: Math.round(data.totalDuration / data.count),
      totalTokens: data.totalTokens,
      successRate: Math.round((data.successCount / data.count) * 100),
      lastUsed: data.lastUsed,
    })).sort((a, b) => b.count - a.count);
  }

  /**
   * Get workflow usage statistics
   */
  getWorkflowUsage(): WorkflowUsage[] {
    const usageMap = new Map<string, {
      count: number;
      completedCount: number;
      totalDuration: number;
      lastRun: string;
    }>();

    for (const event of this.events) {
      if (event.type !== 'workflow') continue;

      const existing = usageMap.get(event.name) || {
        count: 0,
        completedCount: 0,
        totalDuration: 0,
        lastRun: '',
      };

      existing.count++;
      existing.totalDuration += event.duration;
      if (event.success) existing.completedCount++;
      if (event.timestamp > existing.lastRun) {
        existing.lastRun = event.timestamp;
      }

      usageMap.set(event.name, existing);
    }

    return Array.from(usageMap.entries()).map(([workflow, data]) => ({
      workflow,
      count: data.count,
      completedCount: data.completedCount,
      avgDuration: Math.round(data.totalDuration / data.count),
      avgStages: 0, // Would need to track stages
      lastRun: data.lastRun,
    })).sort((a, b) => b.count - a.count);
  }

  /**
   * Get project-wide metrics
   */
  getProjectMetrics(): ProjectMetrics {
    const skillUsage = this.getSkillUsage();
    const workflowUsage = this.getWorkflowUsage();

    const totalSkillRuns = skillUsage.reduce((sum, s) => sum + s.count, 0);
    const totalWorkflowRuns = workflowUsage.reduce((sum, w) => sum + w.count, 0);
    const totalTokensUsed = this.events.reduce((sum, e) => sum + e.tokensIn + e.tokensOut, 0);
    const totalTimeSpent = this.events.reduce((sum, e) => sum + e.duration, 0);
    const totalArtifacts = this.events.reduce((sum, e) => sum + e.artifacts, 0);

    const firstEvent = this.events[0];
    const lastEvent = this.events[this.events.length - 1];

    return {
      totalSkillRuns,
      totalWorkflowRuns,
      totalTokensUsed,
      totalTimeSpent,
      totalArtifacts,
      totalDecisions: 0, // Would need to integrate with memory
      avgSessionDuration: this.events.length > 0 ? Math.round(totalTimeSpent / this.events.length) : 0,
      mostUsedSkill: skillUsage[0]?.skill || null,
      mostUsedWorkflow: workflowUsage[0]?.workflow || null,
      projectStarted: firstEvent?.timestamp || new Date().toISOString(),
      lastActivity: lastEvent?.timestamp || new Date().toISOString(),
    };
  }

  /**
   * Get daily metrics for a date range
   */
  getDailyMetrics(startDate: string, endDate: string): DailyMetrics[] {
    const metrics: DailyMetrics[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (const [date, metric] of this.dailyMetrics) {
      const d = new Date(date);
      if (d >= start && d <= end) {
        metrics.push(metric);
      }
    }

    return metrics.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get metrics for last N days
   */
  getRecentMetrics(days: number): DailyMetrics[] {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);

    return this.getDailyMetrics(
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0]
    );
  }

  /**
   * Generate analytics report
   */
  async generateReport(): Promise<string> {
    const projectMetrics = this.getProjectMetrics();
    const skillUsage = this.getSkillUsage();
    const workflowUsage = this.getWorkflowUsage();
    const recentMetrics = this.getRecentMetrics(7);

    let report = `# 🔮 OMGBUILD Analytics Report

Generated: ${new Date().toISOString()}

## Project Overview

| Metric | Value |
|--------|-------|
| Total Skill Runs | ${projectMetrics.totalSkillRuns} |
| Total Workflow Runs | ${projectMetrics.totalWorkflowRuns} |
| Total Tokens Used | ${projectMetrics.totalTokensUsed.toLocaleString()} |
| Total Time Spent | ${Math.round(projectMetrics.totalTimeSpent / 1000 / 60)} minutes |
| Artifacts Generated | ${projectMetrics.totalArtifacts} |
| Most Used Skill | ${projectMetrics.mostUsedSkill || 'N/A'} |
| Most Used Workflow | ${projectMetrics.mostUsedWorkflow || 'N/A'} |

## Skill Usage

| Skill | Runs | Avg Duration | Success Rate | Tokens |
|-------|------|--------------|--------------|--------|
${skillUsage.map(s => 
  `| ${s.skill} | ${s.count} | ${Math.round(s.avgDuration / 1000)}s | ${s.successRate}% | ${s.totalTokens.toLocaleString()} |`
).join('\n')}

## Workflow Usage

| Workflow | Runs | Completed | Avg Duration |
|----------|------|-----------|--------------|
${workflowUsage.map(w =>
  `| ${w.workflow} | ${w.count} | ${w.completedCount} | ${Math.round(w.avgDuration / 1000)}s |`
).join('\n')}

## Last 7 Days

| Date | Skills | Workflows | Tokens | Time |
|------|--------|-----------|--------|------|
${recentMetrics.map(m =>
  `| ${m.date} | ${m.skillRuns} | ${m.workflowRuns} | ${m.tokensUsed.toLocaleString()} | ${Math.round(m.timeSpent / 1000 / 60)}m |`
).join('\n')}

---
*Generated by OMGBUILD Analytics*
`;

    // Save report
    const reportPath = path.join(this.analyticsDir, `report-${Date.now()}.md`);
    await fs.writeFile(reportPath, report, 'utf-8');

    return report;
  }

  /**
   * Export analytics data
   */
  async export(outputPath: string): Promise<void> {
    const data = {
      exportedAt: new Date().toISOString(),
      projectMetrics: this.getProjectMetrics(),
      skillUsage: this.getSkillUsage(),
      workflowUsage: this.getWorkflowUsage(),
      dailyMetrics: Array.from(this.dailyMetrics.values()),
      recentEvents: this.events.slice(-100),
    };

    await fs.writeFile(outputPath, yaml.dump(data), 'utf-8');
  }

  /**
   * Clear all analytics data
   */
  async clear(): Promise<void> {
    this.events = [];
    this.dailyMetrics.clear();
    
    await fs.emptyDir(this.analyticsDir);
    await fs.ensureDir(this.analyticsDir);
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export async function createAnalyticsManager(omgbuildDir: string): Promise<AnalyticsManager> {
  const manager = new AnalyticsManager(omgbuildDir);
  await manager.initialize();
  return manager;
}
