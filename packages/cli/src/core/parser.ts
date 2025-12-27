/**
 * 🔮 OMGBUILD Parser Module
 * Parse skills, workflows, and rules
 */

import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';

// ============================================================================
// SKILL PARSER
// ============================================================================

export interface Skill {
  name: string;
  purpose: string;
  capabilities: string[];
  inputFormat: string;
  outputFormat: string;
  prompts: Record<string, string>;
  examples: Array<{
    input: string;
    output: string;
  }>;
  integrationPoints: {
    inputFrom: string[];
    outputTo: string[];
  };
}

export async function parseSkill(skillPath: string): Promise<Skill> {
  const content = await fs.readFile(skillPath, 'utf-8');
  
  // Extract sections from markdown
  const name = extractHeader(content, 1) || path.basename(path.dirname(skillPath));
  const purpose = extractSection(content, 'Purpose') || '';
  const capabilities = extractListItems(content, 'Capabilities');
  const inputFormat = extractCodeBlock(content, 'Input Format') || '';
  const outputFormat = extractCodeBlock(content, 'Output Format') || '';
  const prompts = extractPrompts(content);
  const examples = extractExamples(content);
  const integrationPoints = extractIntegrationPoints(content);

  return {
    name,
    purpose,
    capabilities,
    inputFormat,
    outputFormat,
    prompts,
    examples,
    integrationPoints,
  };
}

// ============================================================================
// WORKFLOW PARSER
// ============================================================================

export interface WorkflowStage {
  id: string;
  name: string;
  skill?: string;
  type?: string;
  depends_on?: string[];
  inputs?: Array<{
    name?: string;
    prompt?: string;
    required?: boolean;
    from_stage?: string;
    artifact?: string;
  }>;
  outputs?: string[];
  gate?: {
    type: 'human_review' | 'auto';
    message?: string;
    condition?: string;
  };
  actions?: string[];
  parallel?: boolean;
}

export interface Workflow {
  name: string;
  description: string;
  version: string;
  triggers: Array<{
    command: string;
  }>;
  stages: WorkflowStage[];
  artifacts?: {
    location: string;
  };
  memory?: {
    store_decision: boolean;
    store_patterns: boolean;
  };
}

export async function parseWorkflow(workflowPath: string): Promise<Workflow> {
  const content = await fs.readFile(workflowPath, 'utf-8');
  const workflow = yaml.load(content) as Workflow;
  
  // Validate required fields
  if (!workflow.name) {
    throw new Error(`Workflow missing name: ${workflowPath}`);
  }
  if (!workflow.stages || workflow.stages.length === 0) {
    throw new Error(`Workflow has no stages: ${workflowPath}`);
  }

  return workflow;
}

export function getWorkflowStageOrder(workflow: Workflow): string[] {
  // Topological sort of stages based on dependencies
  const order: string[] = [];
  const visited = new Set<string>();
  const inProgress = new Set<string>();

  function visit(stageId: string) {
    if (visited.has(stageId)) return;
    if (inProgress.has(stageId)) {
      throw new Error(`Circular dependency detected at stage: ${stageId}`);
    }

    inProgress.add(stageId);

    const stage = workflow.stages.find(s => s.id === stageId);
    if (stage?.depends_on) {
      for (const dep of stage.depends_on) {
        visit(dep);
      }
    }

    inProgress.delete(stageId);
    visited.add(stageId);
    order.push(stageId);
  }

  for (const stage of workflow.stages) {
    visit(stage.id);
  }

  return order;
}

// ============================================================================
// RULE PARSER
// ============================================================================

export interface Rule {
  name: string;
  content: string;
  sections: Record<string, string>;
  checklistItems: string[];
}

export async function parseRule(rulePath: string): Promise<Rule> {
  const content = await fs.readFile(rulePath, 'utf-8');
  const name = extractHeader(content, 1) || path.basename(rulePath, '.md');
  
  const sections: Record<string, string> = {};
  const sectionMatches = content.matchAll(/^## (.+)$\n([\s\S]*?)(?=\n## |$)/gm);
  
  for (const match of sectionMatches) {
    sections[match[1].trim()] = match[2].trim();
  }

  const checklistItems = extractChecklistItems(content);

  return {
    name,
    content,
    sections,
    checklistItems,
  };
}

// ============================================================================
// TEMPLATE PARSER
// ============================================================================

export interface Template {
  name: string;
  content: string;
  placeholders: string[];
}

export async function parseTemplate(templatePath: string): Promise<Template> {
  const content = await fs.readFile(templatePath, 'utf-8');
  const name = path.basename(templatePath, '.md');
  
  // Find all placeholders like [Name], [Description], etc.
  const placeholderMatches = content.matchAll(/\[([^\]]+)\]/g);
  const placeholders = [...new Set([...placeholderMatches].map(m => m[1]))];

  return {
    name,
    content,
    placeholders,
  };
}

export function renderTemplate(template: Template, values: Record<string, string>): string {
  let rendered = template.content;
  
  for (const [key, value] of Object.entries(values)) {
    rendered = rendered.replace(new RegExp(`\\[${key}\\]`, 'g'), value);
  }

  return rendered;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function extractHeader(content: string, level: number): string | null {
  const regex = new RegExp(`^${'#'.repeat(level)} (.+)$`, 'm');
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

function extractSection(content: string, sectionName: string): string | null {
  const regex = new RegExp(`^## ${sectionName}\\s*\n([\\s\\S]*?)(?=\n## |$)`, 'm');
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

function extractListItems(content: string, sectionName: string): string[] {
  const section = extractSection(content, sectionName);
  if (!section) return [];
  
  const items: string[] = [];
  const matches = section.matchAll(/^\d+\.\s+\*\*(.+?)\*\*\s*[-–]\s*(.+)$/gm);
  
  for (const match of matches) {
    items.push(`${match[1]}: ${match[2]}`);
  }
  
  return items;
}

function extractCodeBlock(content: string, sectionName: string): string | null {
  const section = extractSection(content, sectionName);
  if (!section) return null;
  
  const match = section.match(/```[\w]*\n([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}

function extractPrompts(content: string): Record<string, string> {
  const prompts: Record<string, string> = {};
  const promptsSection = extractSection(content, 'Prompts');
  
  if (!promptsSection) return prompts;
  
  const promptMatches = promptsSection.matchAll(/### (.+)\n```[\s\S]*?\n([\s\S]*?)```/g);
  
  for (const match of promptMatches) {
    prompts[match[1].trim()] = match[2].trim();
  }
  
  return prompts;
}

function extractExamples(content: string): Array<{ input: string; output: string }> {
  const examples: Array<{ input: string; output: string }> = [];
  const examplesSection = extractSection(content, 'Examples');
  
  if (!examplesSection) return examples;
  
  // Find Example Input/Output pairs
  const inputMatches = examplesSection.matchAll(/### Example Input\n```[\w]*\n([\s\S]*?)```/g);
  const outputMatches = examplesSection.matchAll(/### Example Output\n```[\w]*\n([\s\S]*?)```/g);
  
  const inputs = [...inputMatches].map(m => m[1].trim());
  const outputs = [...outputMatches].map(m => m[1].trim());
  
  for (let i = 0; i < Math.min(inputs.length, outputs.length); i++) {
    examples.push({ input: inputs[i], output: outputs[i] });
  }
  
  return examples;
}

function extractIntegrationPoints(content: string): { inputFrom: string[]; outputTo: string[] } {
  const section = extractSection(content, 'Integration Points');
  
  if (!section) {
    return { inputFrom: [], outputTo: [] };
  }
  
  const inputMatch = section.match(/\*\*Input from\*\*:\s*(.+)/);
  const outputMatch = section.match(/\*\*Output to\*\*:\s*(.+)/);
  
  return {
    inputFrom: inputMatch ? inputMatch[1].split(',').map(s => s.trim()) : [],
    outputTo: outputMatch ? outputMatch[1].split(',').map(s => s.trim()) : [],
  };
}

function extractChecklistItems(content: string): string[] {
  const items: string[] = [];
  const matches = content.matchAll(/^- \[ \] (.+)$/gm);
  
  for (const match of matches) {
    items.push(match[1].trim());
  }
  
  return items;
}

// ============================================================================
// DIRECTORY PARSER
// ============================================================================

export async function parseAllSkills(skillsDir: string): Promise<Map<string, Skill>> {
  const skills = new Map<string, Skill>();
  
  if (!await fs.pathExists(skillsDir)) {
    return skills;
  }
  
  const entries = await fs.readdir(skillsDir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const skillPath = path.join(skillsDir, entry.name, 'SKILL.md');
      if (await fs.pathExists(skillPath)) {
        const skill = await parseSkill(skillPath);
        skills.set(entry.name, skill);
      }
    }
  }
  
  return skills;
}

export async function parseAllWorkflows(workflowsDir: string): Promise<Map<string, Workflow>> {
  const workflows = new Map<string, Workflow>();
  
  if (!await fs.pathExists(workflowsDir)) {
    return workflows;
  }
  
  const entries = await fs.readdir(workflowsDir);
  
  for (const entry of entries) {
    if (entry.endsWith('.yaml') || entry.endsWith('.yml')) {
      const workflowPath = path.join(workflowsDir, entry);
      const workflow = await parseWorkflow(workflowPath);
      workflows.set(workflow.name, workflow);
    }
  }
  
  return workflows;
}

export async function parseAllRules(rulesDir: string): Promise<Map<string, Rule>> {
  const rules = new Map<string, Rule>();
  
  if (!await fs.pathExists(rulesDir)) {
    return rules;
  }
  
  const entries = await fs.readdir(rulesDir);
  
  for (const entry of entries) {
    if (entry.endsWith('.md')) {
      const rulePath = path.join(rulesDir, entry);
      const rule = await parseRule(rulePath);
      rules.set(entry.replace('.md', ''), rule);
    }
  }
  
  return rules;
}
