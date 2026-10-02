import type { DashboardSpec } from './types';

/**
 * Extracts a DashboardSpec JSON from raw AI output.
 * Handles:
 *  - Clean JSON objects
 *  - Markdown code fences (```json ... ```)
 *  - JSON embedded inside prose
 */
export function parseSpec(raw: string): DashboardSpec {
  const cleaned = raw.trim();

  // 1. Try to extract from a markdown code block first
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    return JSON.parse(fenceMatch[1].trim()) as DashboardSpec;
  }

  // 2. Try the whole text as JSON
  try {
    return JSON.parse(cleaned) as DashboardSpec;
  } catch {
    // fall through
  }

  // 3. Find the first { ... } block by scanning brackets
  const start = cleaned.indexOf('{');
  if (start !== -1) {
    let depth = 0;
    for (let i = start; i < cleaned.length; i++) {
      if (cleaned[i] === '{') depth++;
      else if (cleaned[i] === '}') {
        depth--;
        if (depth === 0) {
          const candidate = cleaned.slice(start, i + 1);
          return JSON.parse(candidate) as DashboardSpec;
        }
      }
    }
  }

  throw new Error('No valid JSON found in model output.');
}

/**
 * Validates that the parsed object has the minimum required shape.
 */
export function isValidSpec(obj: unknown): obj is DashboardSpec {
  if (typeof obj !== 'object' || obj === null) return false;
  const s = obj as Record<string, unknown>;
  return (
    typeof s['title'] === 'string' &&
    Array.isArray(s['widgets']) &&
    (s['widgets'] as unknown[]).length > 0
  );
}
