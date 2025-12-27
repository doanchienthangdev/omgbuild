/**
 * 🔮 OMGBUILD Analytics Command
 * Track productivity metrics and generate reports
 */

import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'path';
import { createAnalyticsManager } from '../core/analytics';

// ============================================================================
// ANALYTICS COMMAND
// ============================================================================

export const analyticsCommand = new Command('analytics')
  .alias('stats')
  .description('Track productivity metrics and generate reports')
  .action(async () => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    if (!await fs.pathExists(omgbuildDir)) {
      console.error('❌ No .omgbuild directory found. Run `omgbuild init` first.');
      process.exit(1);
    }

    const manager = await createAnalyticsManager(omgbuildDir);
    const metrics = manager.getProjectMetrics();

    console.log(`
🔮 OMGBUILD Analytics
${'═'.repeat(60)}

📊 Project Overview
${'─'.repeat(40)}
   Total Skill Runs:     ${metrics.totalSkillRuns}
   Total Workflow Runs:  ${metrics.totalWorkflowRuns}
   Total Tokens Used:    ${metrics.totalTokensUsed.toLocaleString()}
   Total Time Spent:     ${formatDuration(metrics.totalTimeSpent)}
   Artifacts Generated:  ${metrics.totalArtifacts}

🏆 Top Stats
${'─'.repeat(40)}
   Most Used Skill:      ${metrics.mostUsedSkill || 'N/A'}
   Most Used Workflow:   ${metrics.mostUsedWorkflow || 'N/A'}
   Avg Session Duration: ${formatDuration(metrics.avgSessionDuration)}

📅 Activity
${'─'.repeat(40)}
   Project Started:      ${formatDate(metrics.projectStarted)}
   Last Activity:        ${formatDate(metrics.lastActivity)}

Commands:
   omgbuild analytics skills      Skill usage breakdown
   omgbuild analytics workflows   Workflow usage breakdown
   omgbuild analytics daily       Daily metrics
   omgbuild analytics report      Generate full report
   omgbuild analytics export      Export analytics data
`);
  });

// ============================================================================
// SKILLS ANALYTICS
// ============================================================================

analyticsCommand
  .command('skills')
  .description('Show skill usage breakdown')
  .option('-n, --limit <n>', 'Number of skills to show', '10')
  .action(async (options: { limit: string }) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    if (!await fs.pathExists(omgbuildDir)) {
      console.error('❌ No .omgbuild directory found.');
      process.exit(1);
    }

    const manager = await createAnalyticsManager(omgbuildDir);
    const skillUsage = manager.getSkillUsage().slice(0, parseInt(options.limit));

    console.log(`
📊 Skill Usage Analytics
${'═'.repeat(70)}

`);

    if (skillUsage.length === 0) {
      console.log('   No skill usage data yet. Run some skills first!\n');
      console.log('   Example: omgbuild run skill analyze "Describe your feature"');
      return;
    }

    // Header
    console.log(`${'Skill'.padEnd(15)} ${'Runs'.padStart(6)} ${'Avg Time'.padStart(10)} ${'Success'.padStart(8)} ${'Tokens'.padStart(10)}`);
    console.log('─'.repeat(70));

    for (const skill of skillUsage) {
      console.log(
        `${skill.skill.padEnd(15)} ` +
        `${skill.count.toString().padStart(6)} ` +
        `${formatDuration(skill.avgDuration).padStart(10)} ` +
        `${(skill.successRate + '%').padStart(8)} ` +
        `${skill.totalTokens.toLocaleString().padStart(10)}`
      );
    }

    console.log('─'.repeat(70));
    console.log(`\nTotal: ${skillUsage.reduce((sum, s) => sum + s.count, 0)} runs`);
  });

// ============================================================================
// WORKFLOWS ANALYTICS
// ============================================================================

analyticsCommand
  .command('workflows')
  .description('Show workflow usage breakdown')
  .action(async () => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    if (!await fs.pathExists(omgbuildDir)) {
      console.error('❌ No .omgbuild directory found.');
      process.exit(1);
    }

    const manager = await createAnalyticsManager(omgbuildDir);
    const workflowUsage = manager.getWorkflowUsage();

    console.log(`
📊 Workflow Usage Analytics
${'═'.repeat(60)}

`);

    if (workflowUsage.length === 0) {
      console.log('   No workflow usage data yet. Run some workflows first!\n');
      console.log('   Example: omgbuild run workflow feature "Add user authentication"');
      return;
    }

    // Header
    console.log(`${'Workflow'.padEnd(15)} ${'Runs'.padStart(6)} ${'Completed'.padStart(10)} ${'Avg Time'.padStart(12)}`);
    console.log('─'.repeat(60));

    for (const workflow of workflowUsage) {
      const completionRate = workflow.count > 0 
        ? Math.round((workflow.completedCount / workflow.count) * 100) 
        : 0;
      
      console.log(
        `${workflow.workflow.padEnd(15)} ` +
        `${workflow.count.toString().padStart(6)} ` +
        `${(workflow.completedCount + ' (' + completionRate + '%)').padStart(10)} ` +
        `${formatDuration(workflow.avgDuration).padStart(12)}`
      );
    }

    console.log('─'.repeat(60));
  });

// ============================================================================
// DAILY ANALYTICS
// ============================================================================

analyticsCommand
  .command('daily')
  .description('Show daily metrics')
  .option('-d, --days <n>', 'Number of days to show', '7')
  .action(async (options: { days: string }) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    if (!await fs.pathExists(omgbuildDir)) {
      console.error('❌ No .omgbuild directory found.');
      process.exit(1);
    }

    const manager = await createAnalyticsManager(omgbuildDir);
    const days = parseInt(options.days);
    const dailyMetrics = manager.getRecentMetrics(days);

    console.log(`
📅 Daily Metrics (Last ${days} Days)
${'═'.repeat(70)}

`);

    if (dailyMetrics.length === 0) {
      console.log('   No daily metrics available yet.\n');
      return;
    }

    // Header
    console.log(`${'Date'.padEnd(12)} ${'Skills'.padStart(8)} ${'Workflows'.padStart(10)} ${'Tokens'.padStart(12)} ${'Time'.padStart(10)}`);
    console.log('─'.repeat(70));

    for (const metric of dailyMetrics) {
      console.log(
        `${metric.date.padEnd(12)} ` +
        `${metric.skillRuns.toString().padStart(8)} ` +
        `${metric.workflowRuns.toString().padStart(10)} ` +
        `${metric.tokensUsed.toLocaleString().padStart(12)} ` +
        `${formatDuration(metric.timeSpent).padStart(10)}`
      );
    }

    console.log('─'.repeat(70));

    // Summary
    const totals = dailyMetrics.reduce((acc, m) => ({
      skills: acc.skills + m.skillRuns,
      workflows: acc.workflows + m.workflowRuns,
      tokens: acc.tokens + m.tokensUsed,
      time: acc.time + m.timeSpent,
    }), { skills: 0, workflows: 0, tokens: 0, time: 0 });

    console.log(
      `${'TOTAL'.padEnd(12)} ` +
      `${totals.skills.toString().padStart(8)} ` +
      `${totals.workflows.toString().padStart(10)} ` +
      `${totals.tokens.toLocaleString().padStart(12)} ` +
      `${formatDuration(totals.time).padStart(10)}`
    );
  });

// ============================================================================
// REPORT COMMAND
// ============================================================================

analyticsCommand
  .command('report')
  .description('Generate full analytics report')
  .option('-o, --output <file>', 'Output file path')
  .action(async (options: { output?: string }) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    if (!await fs.pathExists(omgbuildDir)) {
      console.error('❌ No .omgbuild directory found.');
      process.exit(1);
    }

    console.log('\n📊 Generating analytics report...\n');

    const manager = await createAnalyticsManager(omgbuildDir);
    const report = await manager.generateReport();

    if (options.output) {
      await fs.writeFile(options.output, report, 'utf-8');
      console.log(`✅ Report saved to: ${options.output}`);
    } else {
      console.log(report);
    }
  });

// ============================================================================
// EXPORT COMMAND
// ============================================================================

analyticsCommand
  .command('export')
  .description('Export analytics data')
  .option('-o, --output <file>', 'Output file path', 'omgbuild-analytics.yaml')
  .action(async (options: { output: string }) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    if (!await fs.pathExists(omgbuildDir)) {
      console.error('❌ No .omgbuild directory found.');
      process.exit(1);
    }

    console.log('\n📦 Exporting analytics data...\n');

    const manager = await createAnalyticsManager(omgbuildDir);
    await manager.export(options.output);

    console.log(`✅ Analytics exported to: ${options.output}`);
  });

// ============================================================================
// CLEAR COMMAND
// ============================================================================

analyticsCommand
  .command('clear')
  .description('Clear all analytics data')
  .option('-f, --force', 'Skip confirmation')
  .action(async (options: { force?: boolean }) => {
    const omgbuildDir = path.join(process.cwd(), '.omgbuild');
    
    if (!await fs.pathExists(omgbuildDir)) {
      console.error('❌ No .omgbuild directory found.');
      process.exit(1);
    }

    if (!options.force) {
      console.log('\n⚠️  This will permanently delete all analytics data.');
      console.log('   Use --force to confirm.\n');
      return;
    }

    const manager = await createAnalyticsManager(omgbuildDir);
    await manager.clear();

    console.log('\n✅ Analytics data cleared.\n');
  });

// ============================================================================
// HELPERS
// ============================================================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  } catch {
    return isoString;
  }
}
