import type { DashboardSpec, StatWidget, Widget } from './types';

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

const text = (v: unknown): string | undefined =>
  typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : undefined;

/** Only accept 6-digit hex colors; StatCard appends '22' to build a tint. */
const hex = (v: unknown): string | undefined =>
  typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim() : undefined;

/**
 * SF Symbol names the renderer will pass to the icon view. A 0.6B model often
 * invents names that don't exist, which render as an empty badge on iOS.
 */
const SF_SYMBOLS = new Set([
  'star.fill', 'heart.fill', 'flame.fill', 'bolt.fill', 'figure.walk', 'figure.run',
  'chart.bar.fill', 'chart.line.uptrend.xyaxis', 'dollarsign.circle.fill',
  'bitcoinsign.circle.fill', 'thermometer', 'drop.fill', 'cloud.fill', 'sun.max.fill',
  'moon.fill', 'wind', 'clock.fill', 'checkmark.circle.fill', 'list.bullet', 'calendar',
  'bell.fill', 'cart.fill', 'house.fill', 'person.fill', 'map.fill', 'bed.double.fill',
  'fork.knife', 'music.note', 'trophy.fill', 'target',
]);

const symbol = (v: unknown): string | undefined => {
  const name = text(v)?.trim();
  if (!name) return undefined;
  return SF_SYMBOLS.has(name) ? name : 'star.fill';
};

/**
 * Pulls the first JSON object out of the text. If the model was cut off
 * (maxNewTokens) it keeps everything up to the last finished container and
 * closes the rest, so a truncated dashboard still renders with the widgets
 * that were completed.
 */
function extractJson(src: string): string {
  const start = src.indexOf('{');
  if (start === -1) throw new Error('No JSON object found in model output.');

  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  let lastGood = -1;
  let lastStack: string[] = [];

  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') stack.push('}');
    else if (c === '[') stack.push(']');
    else if (c === '}' || c === ']') {
      stack.pop();
      if (stack.length === 0) return src.slice(start, i + 1);
      lastGood = i;
      lastStack = [...stack];
    }
  }

  if (lastGood === -1) throw new Error('Output was cut off before any widget finished.');
  return src.slice(start, lastGood + 1) + [...lastStack].reverse().join('');
}

function normalizeStat(w: Obj): StatWidget | null {
  const value = text(w.value);
  if (value === undefined) return null;
  return {
    type: 'stat',
    label: text(w.label) ?? '',
    value,
    icon: symbol(w.icon),
    color: hex(w.color),
    subtext: text(w.subtext),
  };
}

function normalizeWidget(w: unknown): Widget | null {
  if (!isObj(w)) return null;
  const label = text(w.label) ?? '';
  const color = hex(w.color);

  switch (w.type) {
    case 'stat':
      return normalizeStat(w);

    case 'chart': {
      if (!Array.isArray(w.data)) return null;
      const data = w.data
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n))
        .map((n) => Math.max(0, n));
      if (data.length === 0) return null;
      const xLabels = Array.isArray(w.xLabels) ? w.xLabels.map((x) => text(x) ?? '') : undefined;
      return { type: 'chart', label, data, xLabels, color };
    }

    case 'progress': {
      let v = typeof w.value === 'string' ? parseFloat(w.value) : Number(w.value);
      if (!Number.isFinite(v)) return null;
      if (v > 1) v = v / 100; // model wrote 72 or "72%" instead of 0.72
      return {
        type: 'progress',
        label,
        value: Math.max(0, Math.min(1, v)),
        color,
        subtext: text(w.subtext),
      };
    }

    case 'list': {
      if (!Array.isArray(w.items)) return null;
      const items = w.items.map((x) => text(x)).filter((s): s is string => !!s);
      if (items.length === 0) return null;
      return { type: 'list', label, items, color };
    }

    case 'header':
      return { type: 'header', label, subtext: text(w.subtext), color };

    case 'button':
      return { type: 'button', label, color };

    case 'grid': {
      if (!Array.isArray(w.items)) return null;
      const items = w.items
        .map((i) => (isObj(i) ? normalizeStat(i) : null))
        .filter((s): s is StatWidget => s !== null)
        .slice(0, 4);
      if (items.length === 0) return null;
      return { type: 'grid', items };
    }

    default:
      return null;
  }
}

/** Drops widgets the renderer can't safely draw and coerces loose values. */
function sanitizeSpec(obj: unknown): DashboardSpec | null {
  if (!isObj(obj) || !Array.isArray(obj.widgets)) return null;
  const widgets = obj.widgets
    .map((w) => normalizeWidget(w))
    .filter((w): w is Widget => w !== null);
  if (widgets.length === 0) return null;
  const theme = obj.theme === 'dark' || obj.theme === 'light' ? obj.theme : 'auto';
  return { title: text(obj.title) ?? 'Dashboard', theme, widgets };
}

/**
 * Extracts a DashboardSpec from raw AI output.
 * Handles <think> blocks, markdown fences, prose around the JSON, // comment
 * lines, trailing commas, truncated output, and missing/mistyped fields.
 */
export function parseSpec(raw: string): DashboardSpec {
  let src = raw
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<think>[\s\S]*$/, '')
    .trim();

  const fence = src.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i);
  if (fence) src = fence[1];

  const json = extractJson(src)
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/,\s*([}\]])/g, '$1');

  const spec = sanitizeSpec(JSON.parse(json));
  if (!spec) throw new Error('The model did not produce any usable widgets.');
  return spec;
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
