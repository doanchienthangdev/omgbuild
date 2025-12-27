/**
 * 🔮 OMGBUILD Utilities
 */

import fs from 'fs-extra';
import path from 'path';

/**
 * Find the .omgbuild directory by traversing up from cwd
 */
export async function findOmgbuildRoot(startDir?: string): Promise<string | null> {
  let current = startDir || process.cwd();
  const root = path.parse(current).root;

  while (current !== root) {
    const omgbuildPath = path.join(current, '.omgbuild');
    if (await fs.pathExists(omgbuildPath)) {
      return current;
    }
    current = path.dirname(current);
  }

  return null;
}

/**
 * Generate a unique ID
 */
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Slugify a string
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Parse a simple template string
 */
export function parseTemplate(template: string, values: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), value);
    result = result.replace(new RegExp(`\\[${key}\\]`, 'g'), value);
  }
  return result;
}

/**
 * Deep merge objects
 */
export function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = result[key];
      
      if (
        typeof sourceValue === 'object' && 
        sourceValue !== null && 
        !Array.isArray(sourceValue) &&
        typeof targetValue === 'object' && 
        targetValue !== null && 
        !Array.isArray(targetValue)
      ) {
        result[key] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        ) as T[typeof key];
      } else {
        result[key] = sourceValue as T[typeof key];
      }
    }
  }
  
  return result;
}

/**
 * Pretty print JSON
 */
export function prettyJson(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

/**
 * Safe JSON parse
 */
export function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

/**
 * Box drawing for CLI output
 */
export function box(content: string, width: number = 60): string {
  const lines = content.split('\n');
  const maxLen = Math.min(width - 4, Math.max(...lines.map(l => l.length)));
  
  const top = '╔' + '═'.repeat(maxLen + 2) + '╗';
  const bottom = '╚' + '═'.repeat(maxLen + 2) + '╝';
  const middle = lines.map(line => {
    const padded = line.padEnd(maxLen);
    return '║ ' + padded + ' ║';
  }).join('\n');
  
  return [top, middle, bottom].join('\n');
}

/**
 * Progress bar
 */
export function progressBar(current: number, total: number, width: number = 30): string {
  const percentage = Math.min(100, Math.round((current / total) * 100));
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percentage}%`;
}
