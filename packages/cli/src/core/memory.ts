/**
 * 🔮 OMGBUILD Memory Manager
 * Project intelligence and learning system
 */

import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';

// ============================================================================
// TYPES
// ============================================================================

export interface Decision {
  id: string;
  date: string;
  title: string;
  context: string;
  decision: string;
  consequences: string[];
  tags?: string[];
  supersedes?: string;
}

export interface Pattern {
  id: string;
  name: string;
  description: string;
  category: string;
  occurrences: number;
  lastSeen: string;
  examples: string[];
  relatedPatterns?: string[];
}

export interface Learning {
  id: string;
  date: string;
  category: 'success' | 'failure' | 'optimization' | 'insight';
  title: string;
  learning: string;
  source: string;
  actionItems?: string[];
}

export interface MemoryStats {
  decisions: number;
  patterns: number;
  learnings: number;
  lastUpdated: string | null;
}

export interface SearchResult<T> {
  item: T;
  score: number;
  matches: string[];
}

// ============================================================================
// MEMORY MANAGER
// ============================================================================

export class MemoryManager {
  private omgbuildDir: string;
  private memoryDir: string;
  private decisions: Map<string, Decision> = new Map();
  private patterns: Map<string, Pattern> = new Map();
  private learnings: Map<string, Learning> = new Map();

  constructor(omgbuildDir: string) {
    this.omgbuildDir = omgbuildDir;
    this.memoryDir = path.join(omgbuildDir, 'memory');
  }

  /**
   * Initialize memory by loading existing data
   */
  async initialize(): Promise<void> {
    await this.loadDecisions();
    await this.loadPatterns();
    await this.loadLearnings();
  }

  // ============================================================================
  // DECISIONS
  // ============================================================================

  private async loadDecisions(): Promise<void> {
    const dir = path.join(this.memoryDir, 'decisions');
    if (!await fs.pathExists(dir)) return;

    const files = await fs.readdir(dir);
    for (const file of files) {
      if (file.endsWith('.yaml') || file.endsWith('.yml')) {
        try {
          const content = await fs.readFile(path.join(dir, file), 'utf-8');
          const decision = yaml.load(content) as Decision;
          this.decisions.set(decision.id, decision);
        } catch {
          // Skip invalid files
        }
      }
    }
  }

  async saveDecision(input: Omit<Decision, 'id' | 'date'>): Promise<Decision> {
    const id = `decision-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const decision: Decision = {
      id,
      date: new Date().toISOString(),
      ...input,
    };

    const dir = path.join(this.memoryDir, 'decisions');
    await fs.ensureDir(dir);

    const filePath = path.join(dir, `${id}.yaml`);
    await fs.writeFile(filePath, yaml.dump(decision), 'utf-8');

    this.decisions.set(id, decision);
    return decision;
  }

  getDecisions(limit?: number): Decision[] {
    const all = Array.from(this.decisions.values())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return limit ? all.slice(0, limit) : all;
  }

  searchDecisions(query: string): SearchResult<Decision>[] {
    const queryLower = query.toLowerCase();
    const results: SearchResult<Decision>[] = [];

    for (const decision of this.decisions.values()) {
      const matches: string[] = [];
      let score = 0;

      if (decision.title.toLowerCase().includes(queryLower)) {
        score += 10;
        matches.push('title');
      }
      if (decision.decision.toLowerCase().includes(queryLower)) {
        score += 5;
        matches.push('decision');
      }
      if (decision.context.toLowerCase().includes(queryLower)) {
        score += 3;
        matches.push('context');
      }
      if (decision.tags?.some(t => t.toLowerCase().includes(queryLower))) {
        score += 7;
        matches.push('tags');
      }

      if (score > 0) {
        results.push({ item: decision, score, matches });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  // ============================================================================
  // PATTERNS
  // ============================================================================

  private async loadPatterns(): Promise<void> {
    const dir = path.join(this.memoryDir, 'patterns');
    if (!await fs.pathExists(dir)) return;

    const files = await fs.readdir(dir);
    for (const file of files) {
      if (file.endsWith('.yaml') || file.endsWith('.yml')) {
        try {
          const content = await fs.readFile(path.join(dir, file), 'utf-8');
          const pattern = yaml.load(content) as Pattern;
          this.patterns.set(pattern.id, pattern);
        } catch {
          // Skip invalid files
        }
      }
    }
  }

  async savePattern(input: {
    name: string;
    description: string;
    category: string;
    example?: string;
  }): Promise<Pattern> {
    // Check if pattern already exists
    for (const [id, pattern] of this.patterns) {
      if (pattern.name.toLowerCase() === input.name.toLowerCase()) {
        // Update existing pattern
        pattern.occurrences++;
        pattern.lastSeen = new Date().toISOString();
        if (input.example && !pattern.examples.includes(input.example)) {
          pattern.examples.push(input.example);
        }

        const filePath = path.join(this.memoryDir, 'patterns', `${id}.yaml`);
        await fs.writeFile(filePath, yaml.dump(pattern), 'utf-8');
        
        return pattern;
      }
    }

    // Create new pattern
    const id = `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const pattern: Pattern = {
      id,
      name: input.name,
      description: input.description,
      category: input.category,
      occurrences: 1,
      lastSeen: new Date().toISOString(),
      examples: input.example ? [input.example] : [],
    };

    const dir = path.join(this.memoryDir, 'patterns');
    await fs.ensureDir(dir);

    const filePath = path.join(dir, `${id}.yaml`);
    await fs.writeFile(filePath, yaml.dump(pattern), 'utf-8');

    this.patterns.set(id, pattern);
    return pattern;
  }

  getPatterns(category?: string): Pattern[] {
    let patterns = Array.from(this.patterns.values());
    
    if (category) {
      patterns = patterns.filter(p => p.category === category);
    }

    return patterns.sort((a, b) => b.occurrences - a.occurrences);
  }

  getTopPatterns(limit: number = 10): Pattern[] {
    return Array.from(this.patterns.values())
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, limit);
  }

  // ============================================================================
  // LEARNINGS
  // ============================================================================

  private async loadLearnings(): Promise<void> {
    const dir = path.join(this.memoryDir, 'learnings');
    if (!await fs.pathExists(dir)) return;

    const files = await fs.readdir(dir);
    for (const file of files) {
      if (file.endsWith('.yaml') || file.endsWith('.yml')) {
        try {
          const content = await fs.readFile(path.join(dir, file), 'utf-8');
          const learning = yaml.load(content) as Learning;
          this.learnings.set(learning.id, learning);
        } catch {
          // Skip invalid files
        }
      }
    }
  }

  async saveLearning(input: Omit<Learning, 'id' | 'date'>): Promise<Learning> {
    const id = `learning-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const learning: Learning = {
      id,
      date: new Date().toISOString(),
      ...input,
    };

    const dir = path.join(this.memoryDir, 'learnings');
    await fs.ensureDir(dir);

    const filePath = path.join(dir, `${id}.yaml`);
    await fs.writeFile(filePath, yaml.dump(learning), 'utf-8');

    this.learnings.set(id, learning);
    return learning;
  }

  getLearnings(category?: Learning['category']): Learning[] {
    let learnings = Array.from(this.learnings.values());
    
    if (category) {
      learnings = learnings.filter(l => l.category === category);
    }

    return learnings.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  // ============================================================================
  // STATS & UTILITIES
  // ============================================================================

  getStats(): MemoryStats {
    const allDates = [
      ...Array.from(this.decisions.values()).map(d => d.date),
      ...Array.from(this.patterns.values()).map(p => p.lastSeen),
      ...Array.from(this.learnings.values()).map(l => l.date),
    ].filter(Boolean);

    const lastUpdated = allDates.length > 0
      ? allDates.sort().reverse()[0]
      : null;

    return {
      decisions: this.decisions.size,
      patterns: this.patterns.size,
      learnings: this.learnings.size,
      lastUpdated,
    };
  }

  /**
   * Get relevant context for a task
   */
  async getContext(keywords: string[]): Promise<{
    decisions: Decision[];
    patterns: Pattern[];
    learnings: Learning[];
  }> {
    const keywordsLower = keywords.map(k => k.toLowerCase());

    const relevantDecisions = Array.from(this.decisions.values())
      .filter(d => keywordsLower.some(k => 
        d.title.toLowerCase().includes(k) ||
        d.decision.toLowerCase().includes(k) ||
        d.tags?.some(t => t.toLowerCase().includes(k))
      ))
      .slice(0, 5);

    const relevantPatterns = Array.from(this.patterns.values())
      .filter(p => keywordsLower.some(k =>
        p.name.toLowerCase().includes(k) ||
        p.description.toLowerCase().includes(k) ||
        p.category.toLowerCase().includes(k)
      ))
      .slice(0, 5);

    const relevantLearnings = Array.from(this.learnings.values())
      .filter(l => keywordsLower.some(k =>
        l.title.toLowerCase().includes(k) ||
        l.learning.toLowerCase().includes(k)
      ))
      .slice(0, 5);

    return {
      decisions: relevantDecisions,
      patterns: relevantPatterns,
      learnings: relevantLearnings,
    };
  }

  /**
   * Generate memory summary for AI context
   */
  async generateSummary(): Promise<string> {
    const stats = this.getStats();
    const topPatterns = this.getTopPatterns(5);
    const recentDecisions = this.getDecisions(5);
    const recentLearnings = this.getLearnings().slice(0, 5);

    let summary = `# Project Memory Summary

## Statistics
- Decisions: ${stats.decisions}
- Patterns: ${stats.patterns}
- Learnings: ${stats.learnings}
- Last Updated: ${stats.lastUpdated || 'Never'}

`;

    if (topPatterns.length > 0) {
      summary += `## Top Patterns
${topPatterns.map(p => `- **${p.name}** (${p.occurrences}x): ${p.description}`).join('\n')}

`;
    }

    if (recentDecisions.length > 0) {
      summary += `## Recent Decisions
${recentDecisions.map(d => `- **${d.title}**: ${d.decision}`).join('\n')}

`;
    }

    if (recentLearnings.length > 0) {
      summary += `## Recent Learnings
${recentLearnings.map(l => `- [${l.category}] **${l.title}**: ${l.learning}`).join('\n')}
`;
    }

    return summary;
  }

  /**
   * Export all memory to a single file
   */
  async export(outputPath: string): Promise<void> {
    const data = {
      exportedAt: new Date().toISOString(),
      decisions: Array.from(this.decisions.values()),
      patterns: Array.from(this.patterns.values()),
      learnings: Array.from(this.learnings.values()),
    };

    await fs.writeFile(outputPath, yaml.dump(data), 'utf-8');
  }

  /**
   * Import memory from a file
   */
  async import(inputPath: string): Promise<{ imported: number; skipped: number }> {
    const content = await fs.readFile(inputPath, 'utf-8');
    const data = yaml.load(content) as {
      decisions?: Decision[];
      patterns?: Pattern[];
      learnings?: Learning[];
    };

    let imported = 0;
    let skipped = 0;

    // Import decisions
    if (data.decisions) {
      for (const decision of data.decisions) {
        if (!this.decisions.has(decision.id)) {
          this.decisions.set(decision.id, decision);
          const filePath = path.join(this.memoryDir, 'decisions', `${decision.id}.yaml`);
          await fs.ensureDir(path.dirname(filePath));
          await fs.writeFile(filePath, yaml.dump(decision), 'utf-8');
          imported++;
        } else {
          skipped++;
        }
      }
    }

    // Import patterns
    if (data.patterns) {
      for (const pattern of data.patterns) {
        if (!this.patterns.has(pattern.id)) {
          this.patterns.set(pattern.id, pattern);
          const filePath = path.join(this.memoryDir, 'patterns', `${pattern.id}.yaml`);
          await fs.ensureDir(path.dirname(filePath));
          await fs.writeFile(filePath, yaml.dump(pattern), 'utf-8');
          imported++;
        } else {
          skipped++;
        }
      }
    }

    // Import learnings
    if (data.learnings) {
      for (const learning of data.learnings) {
        if (!this.learnings.has(learning.id)) {
          this.learnings.set(learning.id, learning);
          const filePath = path.join(this.memoryDir, 'learnings', `${learning.id}.yaml`);
          await fs.ensureDir(path.dirname(filePath));
          await fs.writeFile(filePath, yaml.dump(learning), 'utf-8');
          imported++;
        } else {
          skipped++;
        }
      }
    }

    return { imported, skipped };
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export async function createMemoryManager(omgbuildDir: string): Promise<MemoryManager> {
  const manager = new MemoryManager(omgbuildDir);
  await manager.initialize();
  return manager;
}
