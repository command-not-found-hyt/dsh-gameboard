/**
 * Pure board-document helpers for the Gameboard plugin.
 *
 * This module is intentionally free of IO and third-party dependencies.
 * It owns the markdown front-matter format, item normalisation, and the
 * aggregate views (counts, areas, digest) consumed by the Host.
 */

export const STAGES = ['idea', 'spec', 'building', 'built', 'tested', 'shipped'];
export const DECISION = ['none', 'pending', 'decided'];
export const MANUAL = ['none', 'pending', 'done'];
export const TEST = ['untested', 'failing', 'passing'];
export const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

const OWNERS = ['ai', 'human'];

/** Every disk field that is mapped onto a normalised Item. */
const KNOWN_META_KEYS = new Set([
  'id',
  'title',
  'area',
  'stage',
  'priority',
  'owner',
  'decision',
  'decision_question',
  'decision_options',
  'decision_impact',
  'decision_deadline',
  'decision_choice',
  'decision_at',
  'decision_by',
  'manual',
  'manual_steps',
  'manual_done',
  'manual_estimate',
  'test',
  'test_report',
  'test_match',
  'match',
  'tags',
  'links',
  'created_at',
  'updated_at',
  'updated_by',
]);

const FENCE = /^---\s*$/;
const META_LINE = /^([A-Za-z0-9_]+)\s*:\s?(.*)$/;
const META_KEY = /^[A-Za-z0-9_]+$/;

const DERIVED_DEFAULTS = () => ({
  filesMatched: 0,
  fileList: [],
  lastChangedAt: null,
  testStatus: null,
  testTotal: 0,
  testFailed: 0,
  missing: false,
  truncated: false,
});

function scalarText(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map((entry) => scalarText(entry)).join(', ');
  return String(value);
}

function normaliseLineEndings(text) {
  return String(text == null ? '' : text).replace(/\r\n?/g, '\n');
}

function isoNow(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date().toISOString() : value.toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).toISOString();
  if (typeof value === 'string' && value.trim()) return value;
  return new Date().toISOString();
}

/**
 * Split an inline array literal such as `["a, b", c]` respecting quotes.
 * The surrounding brackets are not included in `inner`.
 */
function splitArrayItems(inner) {
  const items = [];
  let current = '';
  let quote = '';
  let escaped = false;

  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (quote) {
      if (ch === '\\') {
        current += ch;
        escaped = true;
        continue;
      }
      if (ch === quote) {
        current += ch;
        quote = '';
        continue;
      }
      current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === ',') {
      items.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  items.push(current);

  return items.map((item) => {
    let value = item.trim();
    if (value.length >= 2) {
      const first = value[0];
      const last = value[value.length - 1];
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        value = value.slice(1, -1);
        value = value.replace(/\\(["'\\])/g, '$1');
      }
    }
    return value;
  });
}

function parseArrayValue(value, errors, key) {
  const raw = String(value);
  const closed = raw.endsWith(']');
  if (!closed) errors.push(`unterminated array for "${key}"`);
  const inner = raw.slice(1, closed ? raw.length - 1 : raw.length);
  if (!inner.trim()) return [];
  return splitArrayItems(inner);
}

/**
 * Parse a board markdown document.
 *
 * Tolerant by design: malformed front matter never throws. Fatal format
 * problems (missing opener/closer) are reported in `errors` and flagged with
 * `fatal: true` so the scanner can skip that one file.
 *
 * @returns {{meta: Record<string, any>, raw: Record<string, any>, body: string, errors: string[], fatal: boolean}}
 */
export function parseBoardDoc(text) {
  const errors = [];
  const meta = {};
  const source = normaliseLineEndings(text).replace(/^\uFEFF/, '');
  const lines = source.split('\n');

  if (!lines.length || !FENCE.test(lines[0])) {
    errors.push('missing front matter opening "---"');
    return { meta: {}, raw: {}, body: source, errors, fatal: true };
  }

  let closeIndex = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (FENCE.test(lines[i])) {
      closeIndex = i;
      break;
    }
  }

  const metaEnd = closeIndex === -1 ? lines.length : closeIndex;
  for (let i = 1; i < metaEnd; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    const match = META_LINE.exec(line);
    if (!match) {
      errors.push(`invalid front matter line: "${line}"`);
      continue;
    }
    const key = match[1];
    const value = match[2].trim();
    if (value.startsWith('[')) {
      meta[key] = parseArrayValue(value, errors, key);
    } else {
      meta[key] = value;
    }
  }

  if (closeIndex === -1) {
    errors.push('missing front matter closing "---"');
    return { meta, raw: { ...meta }, body: '', errors, fatal: true };
  }

  let body = lines.slice(closeIndex + 1).join('\n');
  // The serializer always writes exactly one blank line between the closing
  // fence and the notes; strip that single separator so serialise -> parse is
  // an identity for notes.
  if (body.startsWith('\n')) body = body.slice(1);

  return { meta, raw: { ...meta }, body, errors, fatal: false };
}

function toArray(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => scalarText(entry).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      const parsed = parseArrayValue(trimmed, [], 'value');
      return parsed.map((entry) => entry.trim()).filter(Boolean);
    }
    return [trimmed];
  }
  if (value == null) return [];
  return [scalarText(value).trim()].filter(Boolean);
}

function toNumberArray(value) {
  return toArray(value)
    .map((entry) => Number(entry))
    .filter((entry) => Number.isInteger(entry) && entry >= 0);
}

function pickEnum(value, allowed, fallback, field, errors) {
  const normalised = scalarText(value).trim().toLowerCase();
  if (!normalised) return fallback;
  if (allowed.includes(normalised)) return normalised;
  errors.push(`${field}: invalid value "${scalarText(value)}"`);
  return fallback;
}

function withDerived(item) {
  item.derived = DERIVED_DEFAULTS();
  return item;
}

/**
 * Turn a parsed document into a normalised Item.
 *
 * @param {{meta?: Record<string, any>, body?: string, errors?: string[]}|string} doc
 * @param {{id?: string, path?: string, now?: string|Date}} [options]
 */
export function normalizeItem(doc, options = {}) {
  const source = typeof doc === 'string' ? parseBoardDoc(doc) : (doc || {});
  const meta = source.meta && typeof source.meta === 'object' ? source.meta : {};
  const body = source.body != null ? normaliseLineEndings(source.body) : normaliseLineEndings(source.notes);
  const errors = Array.isArray(source.errors) ? [...source.errors] : [];
  const now = isoNow(options.now);

  const metaId = scalarText(meta.id).trim();
  const id = scalarText(options.id ?? metaId).trim() || 'item';
  if (metaId && options.id != null && metaId !== scalarText(options.id).trim()) {
    errors.push(`id "${metaId}" does not match file name "${scalarText(options.id).trim()}"`);
  }

  const title = scalarText(meta.title).trim() || id;
  const area = scalarText(meta.area).trim() || '未分类';

  const item = {
    id,
    title,
    area,
    stage: pickEnum(meta.stage, STAGES, 'idea', 'stage', errors),
    priority: pickEnum(meta.priority, PRIORITIES, 'normal', 'priority', errors),
    owner: pickEnum(meta.owner, OWNERS, 'ai', 'owner', errors),
    tags: toArray(meta.tags),
    links: toArray(meta.links),
    match: toArray(meta.match),
    testMatch: toArray(meta.test_match),
    gates: {
      decision: pickEnum(meta.decision, DECISION, 'none', 'decision', errors),
      manual: pickEnum(meta.manual, MANUAL, 'none', 'manual', errors),
      test: pickEnum(meta.test, TEST, 'untested', 'test', errors),
    },
    decision: {
      question: scalarText(meta.decision_question).trim(),
      options: toArray(meta.decision_options),
      impact: scalarText(meta.decision_impact).trim(),
      deadline: scalarText(meta.decision_deadline).trim(),
      choice: scalarText(meta.decision_choice).trim(),
      at: scalarText(meta.decision_at).trim(),
      by: scalarText(meta.decision_by).trim(),
    },
    manual: {
      steps: toArray(meta.manual_steps),
      done: toNumberArray(meta.manual_done),
      estimate: scalarText(meta.manual_estimate).trim(),
    },
    test: {
      report: scalarText(meta.test_report).trim(),
    },
    createdAt: scalarText(meta.created_at).trim() || now,
    updatedAt: scalarText(meta.updated_at).trim() || scalarText(meta.created_at).trim() || now,
    updatedBy: scalarText(meta.updated_by).trim(),
    path: scalarText(options.path).trim() || `.gameboard/board/${id}.md`,
    notes: body,
    errors,
  };

  withDerived(item);

  // Unknown front-matter keys survive a serialize round-trip without leaking
  // into the public enumerable Item shape (and therefore into the Snapshot).
  const extra = Object.create(null);
  for (const [key, value] of Object.entries(meta)) {
    if (!KNOWN_META_KEYS.has(key)) extra[key] = value;
  }
  if (Object.keys(extra).length) {
    Object.defineProperty(item, 'rawMeta', {
      value: extra,
      enumerable: false,
      writable: true,
      configurable: true,
    });
  }

  return item;
}

function boolArrayJson(value) {
  const array = Array.isArray(value) ? value : toArray(value);
  return JSON.stringify(array.map((entry) => scalarText(entry)));
}

function metaValueJson(value) {
  if (Array.isArray(value)) return boolArrayJson(value);
  return scalarText(value).replace(/\r?\n/g, ' ').trim();
}

/**
 * Serialize an Item back to markdown. `normalizeItem(parseBoardDoc(serializeItem(item)))`
 * is stable for normalised items.
 */
export function serializeItem(item) {
  let source = item && typeof item === 'object' ? item : {};
  // Convenience: accept the direct output of parseBoardDoc as well as an Item.
  if (source.meta && typeof source.meta === 'object' && source.body !== undefined && !source.gates) {
    const metaId = scalarText(source.meta.id).trim();
    source = normalizeItem(source, {
      id: metaId || undefined,
      path: metaId ? `.gameboard/board/${metaId}.md` : undefined,
    });
  }
  const gates = source.gates && typeof source.gates === 'object' ? source.gates : {};
  const decision = source.decision && typeof source.decision === 'object' ? source.decision : {};
  const manual = source.manual && typeof source.manual === 'object' ? source.manual : {};
  const test = source.test && typeof source.test === 'object' ? source.test : {};
  const lines = [];
  const add = (key, value) => lines.push(`${key}: ${value}`);

  add('id', metaValueJson(source.id));
  add('title', metaValueJson(source.title));
  add('area', metaValueJson(source.area));
  add('stage', metaValueJson(source.stage));
  add('priority', metaValueJson(source.priority));
  add('owner', metaValueJson(source.owner));
  add('decision', metaValueJson(gates.decision));
  add('decision_question', metaValueJson(decision.question));
  add('decision_options', boolArrayJson(decision.options));
  add('decision_impact', metaValueJson(decision.impact));
  add('decision_deadline', metaValueJson(decision.deadline));
  add('decision_choice', metaValueJson(decision.choice));
  add('decision_at', metaValueJson(decision.at));
  add('decision_by', metaValueJson(decision.by));
  add('manual', metaValueJson(gates.manual));
  add('manual_steps', boolArrayJson(manual.steps));
  add('manual_done', JSON.stringify(toNumberArray(manual.done)));
  add('manual_estimate', metaValueJson(manual.estimate));
  add('test', metaValueJson(gates.test));
  add('test_report', metaValueJson(test.report));
  add('test_match', boolArrayJson(source.testMatch));
  add('match', boolArrayJson(source.match));
  add('tags', boolArrayJson(source.tags));
  add('links', boolArrayJson(source.links));
  add('created_at', metaValueJson(source.createdAt));
  add('updated_at', metaValueJson(source.updatedAt));
  add('updated_by', metaValueJson(source.updatedBy));

  const rawMeta = source.rawMeta && typeof source.rawMeta === 'object' ? source.rawMeta : {};
  for (const [key, value] of Object.entries(rawMeta)) {
    if (KNOWN_META_KEYS.has(key) || !META_KEY.test(key)) continue;
    add(key, metaValueJson(value));
  }

  const notes = normaliseLineEndings(source.notes);
  return `---\n${lines.join('\n')}\n---\n\n${notes}`;
}

function slugifyPart(value) {
  return scalarText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    // Keep CJK: this board is used in Chinese repositories, where a readable
    // id is worth more than an ASCII-only one.
    .replace(/[^A-Za-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 48);
}

/** area + title -> stable slug id (ASCII/CJK slug, with an `item` fallback). */
export function slugId(area, title) {
  const areaPart = slugifyPart(area);
  const titlePart = slugifyPart(title);
  if (!areaPart && !titlePart) return 'item';
  if (!areaPart) return titlePart || 'item';
  return `${areaPart}.${titlePart || 'item'}`;
}

/** Create a fresh Item with all defaults applied. */
export function emptyItem(input = {}) {
  const now = isoNow(input.now);
  const area = scalarText(input.area).trim() || '未分类';
  const title = scalarText(input.title).trim();
  const id = scalarText(input.id).trim() || slugId(area, title);
  return {
    id,
    title: title || id,
    area,
    stage: 'idea',
    priority: 'normal',
    owner: 'ai',
    tags: [],
    links: [],
    match: [],
    testMatch: [],
    gates: { decision: 'none', manual: 'none', test: 'untested' },
    decision: { question: '', options: [], impact: '', deadline: '', choice: '', at: '', by: '' },
    manual: { steps: [], done: [], estimate: '' },
    test: { report: '' },
    createdAt: now,
    updatedAt: now,
    updatedBy: '',
    path: `.gameboard/board/${id}.md`,
    notes: '',
    errors: [],
    derived: DERIVED_DEFAULTS(),
  };
}

/** Aggregate counts and per-area progress for the snapshot. */
export function summarize(items) {
  const list = Array.isArray(items) ? items : [];
  const counts = {
    total: list.length,
    built: 0,
    tested: 0,
    decisionPending: 0,
    manualPending: 0,
    testFailing: 0,
    missing: 0,
  };
  const areas = new Map();

  for (const raw of list) {
    const item = raw && typeof raw === 'object' ? raw : {};
    const gates = item.gates && typeof item.gates === 'object' ? item.gates : {};
    const stage = scalarText(item.stage).toLowerCase();
    const areaName = scalarText(item.area).trim() || '未分类';
    const built = stage === 'built' || stage === 'tested' || stage === 'shipped';
    const tested = gates.test === 'passing';
    const decisionPending = gates.decision === 'pending';
    const manualPending = gates.manual === 'pending';
    const missing = Boolean(item.derived && item.derived.missing);

    if (built) counts.built += 1;
    if (tested) counts.tested += 1;
    if (decisionPending) counts.decisionPending += 1;
    if (manualPending) counts.manualPending += 1;
    if (gates.test === 'failing') counts.testFailing += 1;
    if (missing) counts.missing += 1;

    let area = areas.get(areaName);
    if (!area) {
      area = { name: areaName, total: 0, built: 0, tested: 0, pending: 0 };
      areas.set(areaName, area);
    }
    area.total += 1;
    if (built) area.built += 1;
    if (tested) area.tested += 1;
    if (decisionPending || manualPending) area.pending += 1;
  }

  const areaList = [...areas.values()].sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });

  return { counts, areas: areaList };
}

const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2, low: 3 };
const STAGE_RANK = { shipped: 5, tested: 4, built: 3, building: 2, spec: 1, idea: 0 };

function itemUrgency(item) {
  const gates = item.gates || {};
  const missing = item.derived && item.derived.missing;
  if (gates.decision === 'pending') return 0;
  if (gates.manual === 'pending') return 1;
  if (gates.test === 'failing') return 2;
  if (missing) return 3;
  if (gates.test === 'passing') return 5;
  return 4;
}

function itemFlags(item) {
  const gates = item.gates || {};
  const flags = [];
  if (gates.decision === 'pending') flags.push('待拍板');
  if (gates.manual === 'pending') flags.push('待手动');
  if (gates.test === 'failing') flags.push('测试失败');
  if (item.derived && item.derived.missing) flags.push('缺失');
  return flags.length ? ` !${flags.join('/')}` : '';
}

/**
 * Compact markdown digest for the AI tool. Never exceeds `options.maxChars`
 * (hard-capped at 900 characters by the contract).
 */
export function digest(items, options = {}) {
  const list = Array.isArray(items) ? items : [];
  const requested = Number(options.maxChars);
  const maxChars = Number.isFinite(requested) && requested > 0
    ? Math.max(40, Math.min(900, Math.floor(requested)))
    : 900;

  const { counts } = summarize(list);
  const header = `看板 ${counts.total} 项 · 开发 ${counts.built} · 测过 ${counts.tested}`
    + ` · 待拍板 ${counts.decisionPending} · 待手动 ${counts.manualPending}`
    + ` · 测试失败 ${counts.testFailing} · 缺失 ${counts.missing}`;

  const sorted = list.slice().sort((a, b) => {
    const urgent = itemUrgency(a) - itemUrgency(b);
    if (urgent) return urgent;
    const priority = (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2);
    if (priority) return priority;
    const stage = (STAGE_RANK[a.stage] ?? 0) - (STAGE_RANK[b.stage] ?? 0);
    if (stage) return stage;
    return String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;
  });

  const requestedLimit = Number(options.limit);
  const limited = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? sorted.slice(0, Math.floor(requestedLimit))
    : sorted;

  const lines = [header];
  for (const item of limited) {
    const area = item.area || '未分类';
    const stage = item.stage || 'idea';
    lines.push(`- ${item.id} · ${item.title || item.id} (${area}/${stage})${itemFlags(item)}`);
  }

  const text = lines.join('\n');
  if (text.length <= maxChars) return text;
  const note = '\n…（已截断）';
  const room = Math.max(0, maxChars - note.length);
  return `${text.slice(0, room)}${note}`.slice(0, maxChars);
}
