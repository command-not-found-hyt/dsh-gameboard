/**
 * Scanner for the Gameboard plugin.
 *
 * All filesystem access goes through the injected `FsAdapter` (see
 * CONTRACT.md). This module never imports Node's `fs` and never throws because
 * of a single bad file: problems are reported in `errors` and scanning
 * continues.
 */

import path from 'node:path';

import { normalizeItem, parseBoardDoc, summarize } from './board.js';

const MAX_DEPTH = 16;
const DEFAULT_MAX_FILES = 20000;
const FILE_LIST_LIMIT = 20;
const MAX_CHANGES = 50;
const BOARD_REL = '.gameboard';
const BOARD_FILES_REL = '.gameboard/board';
const CACHE_REL = '.gameboard/.cache/snapshot.json';

const SKIP_DIR_NAMES = new Set(['.git', 'node_modules', 'dist', 'build']);
const SKIP_REL_DIRS = new Set(['.gameboard/.cache']);

const ZERO_COUNTS = () => ({
  total: 0,
  built: 0,
  tested: 0,
  decisionPending: 0,
  manualPending: 0,
  testFailing: 0,
  missing: 0,
});

function posixPath(value) {
  return String(value == null ? '' : value).replace(/\\/g, '/');
}

function compareStrings(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function errorMessage(error) {
  if (!error) return 'unknown error';
  if (typeof error === 'string') return error;
  return String(error.message || error);
}

function isNotFound(error) {
  const code = error && (error.code || error.errno);
  if (code === 'ENOENT' || code === 'ENOTDIR' || code === 2 || code === 20) return true;
  return /ENOENT|ENOTDIR|no such file|not found|does not exist|不存在|找不到/i.test(errorMessage(error));
}

function isoNow(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date().toISOString() : value.toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value).toISOString();
  if (typeof value === 'string' && value.trim()) return value;
  return new Date().toISOString();
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry == null ? '' : entry).trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function normalizeGlob(pattern) {
  return posixPath(pattern).trim().replace(/^\.\//, '').replace(/\/+$/, '');
}

const globCache = new Map();

/** Compile a repository-relative glob (`**`, `*`, `?`) into a RegExp. */
export function globToRegExp(pattern) {
  const source = normalizeGlob(pattern);
  const cached = globCache.get(source);
  if (cached) return cached;

  let expression = '^';
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '*') {
      if (source[i + 1] === '*') {
        i += 1;
        if (source[i + 1] === '/') {
          i += 1;
          expression += '(?:[^/]+/)*';
        } else {
          expression += '.*';
        }
      } else {
        expression += '[^/]*';
      }
      continue;
    }
    if (ch === '?') {
      expression += '[^/]';
      continue;
    }
    if ('\\^$+.[\]{}()|'.includes(ch)) {
      expression += `\\${ch}`;
      continue;
    }
    expression += ch;
  }
  expression += '$';

  const compiled = new RegExp(expression);
  globCache.set(source, compiled);
  return compiled;
}

/** Match a repository-relative POSIX path against a glob. */
export function matchGlob(pattern, relPath) {
  const normalized = normalizeGlob(pattern);
  if (!normalized) return false;
  return globToRegExp(normalized).test(posixPath(relPath));
}

function isExcluded(relPath, isDirectory, patterns) {
  for (const pattern of patterns) {
    if (matchGlob(pattern, relPath)) return true;
    // `foo/**` should prune the directory `foo` itself, not just its children.
    if (isDirectory && pattern.endsWith('/**') && matchGlob(pattern.slice(0, -3), relPath)) {
      return true;
    }
  }
  return false;
}

/**
 * Recursively collect repository files through the injected FsAdapter.
 *
 * @returns {Promise<{files: Array<{rel: string, version: string, size: number}>, truncated: boolean, errors: Array<{path: string, message: string}>}>}
 */
export async function collectFiles({ fs, root, exclude, maxFiles, signal } = {}) {
  const files = [];
  const errors = [];
  let truncated = false;

  if (!fs || typeof fs.listDir !== 'function') {
    errors.push({ path: '.', message: 'missing fs adapter' });
    return { files, truncated, errors };
  }

  const patterns = normalizeList(exclude);
  const requestedLimit = Number(maxFiles);
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? Math.floor(requestedLimit)
    : DEFAULT_MAX_FILES;

  let rootTarget;
  try {
    rootTarget = await fs.resolve(root);
  } catch (error) {
    errors.push({ path: '.', message: errorMessage(error) });
    return { files, truncated, errors };
  }

  const walk = async (target, rel, depth) => {
    if (truncated || (signal && signal.aborted)) return;
    let entries;
    try {
      entries = await fs.listDir(target);
    } catch (error) {
      if (!isNotFound(error)) errors.push({ path: rel || '.', message: errorMessage(error) });
      return;
    }
    if (!Array.isArray(entries)) entries = [];
    entries = entries.slice().sort((a, b) => compareStrings(String(a && a.name), String(b && b.name)));

    for (const entry of entries) {
      if (truncated || (signal && signal.aborted)) return;
      const name = String((entry && entry.name) || '');
      if (!name) continue;
      const childRel = rel ? `${rel}/${name}` : name;
      const type = entry && entry.type;

      if (type === 'directory') {
        if (SKIP_DIR_NAMES.has(name)) continue;
        if (SKIP_REL_DIRS.has(childRel)) continue;
        if (isExcluded(childRel, true, patterns)) continue;
        if (depth + 1 > MAX_DEPTH) continue;
        await walk(entry.target, childRel, depth + 1);
        continue;
      }
      if (type !== 'file') continue;
      if (isExcluded(childRel, false, patterns)) continue;
      if (files.length >= limit) {
        truncated = true;
        return;
      }
      files.push({
        rel: childRel,
        version: entry.version == null ? '' : String(entry.version),
        size: Number.isFinite(Number(entry.size)) ? Number(entry.size) : 0,
      });
    }
  };

  await walk(rootTarget, '', 0);
  files.sort((a, b) => compareStrings(a.rel, b.rel));
  return { files, truncated, errors };
}

function decodeXmlEntities(value) {
  return String(value).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, entity) => {
    const lower = entity.toLowerCase();
    if (lower === 'amp') return '&';
    if (lower === 'lt') return '<';
    if (lower === 'gt') return '>';
    if (lower === 'quot') return '"';
    if (lower === 'apos') return "'";
    if (lower.startsWith('#x')) {
      const code = Number.parseInt(lower.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (lower.startsWith('#')) {
      const code = Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return match;
  });
}

function parseXmlAttributes(source) {
  const attributes = {};
  const regex = /([A-Za-z_:][A-Za-z0-9_.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match;
  while ((match = regex.exec(source)) !== null) {
    const value = match[2] != null ? match[2] : match[3] != null ? match[3] : match[4];
    attributes[match[1]] = decodeXmlEntities(value == null ? '' : value);
  }
  return attributes;
}

/**
 * Parse JUnit XML using regular expressions (no XML dependency).
 * Returns `{ name, classname, file, status }` records.
 */
export function parseJunitXml(xml) {
  const text = String(xml == null ? '' : xml);
  const cases = [];
  const opener = /<testcase\b([^>]*?)(\/?)>/gi;
  let match;

  while ((match = opener.exec(text)) !== null) {
    const attributes = parseXmlAttributes(match[1]);
    const selfClosing = match[2] === '/' || /\/\s*$/.test(match[1]);
    let failed = false;

    if (!selfClosing) {
      const closeIndex = text.indexOf('</testcase>', opener.lastIndex);
      const inner = closeIndex === -1 ? text.slice(opener.lastIndex) : text.slice(opener.lastIndex, closeIndex);
      failed = /<(?:failure|error)\b/i.test(inner);
      if (closeIndex === -1) {
        opener.lastIndex = text.length;
      } else {
        opener.lastIndex = closeIndex + '</testcase>'.length;
      }
    }

    if (!failed && attributes.status && /fail|error/i.test(attributes.status)) failed = true;

    cases.push({
      name: attributes.name || '',
      classname: attributes.classname || '',
      file: attributes.file || '',
      status: failed ? 'failed' : 'passed',
    });
  }

  return cases;
}

function reportStatus(value) {
  const status = String(value == null ? '' : value).toLowerCase();
  if (!status) return 'passed';
  return /fail|error/.test(status) ? 'failed' : 'passed';
}

/**
 * Parse vitest/jest JSON reports.
 *
 * Supported shapes:
 *   { testResults: [{ name, assertionResults: [{ title, status }] }] }
 *   { tests: [{ name, status }] }
 */
export function parseJsonReport(input) {
  const data = typeof input === 'string' ? JSON.parse(input.replace(/^\uFEFF/, '')) : input;
  const cases = [];
  let recognised = false;

  if (data && Array.isArray(data.testResults)) {
    recognised = true;
    for (const result of data.testResults) {
      if (!result || typeof result !== 'object') continue;
      const file = String(result.name || result.testFilePath || result.file || '');
      const assertions = Array.isArray(result.assertionResults) ? result.assertionResults : [];
      for (const assertion of assertions) {
        if (!assertion || typeof assertion !== 'object') continue;
        const name = String(assertion.title || assertion.fullName || assertion.name || '');
        const ancestor = Array.isArray(assertion.ancestorTitles) ? assertion.ancestorTitles.join(' ') : '';
        cases.push({
          name,
          classname: ancestor,
          file,
          status: reportStatus(assertion.status != null ? assertion.status : assertion.state),
        });
      }
    }
  }

  if (data && Array.isArray(data.tests)) {
    recognised = true;
    for (const test of data.tests) {
      if (!test || typeof test !== 'object') continue;
      cases.push({
        name: String(test.name || test.title || ''),
        classname: String(test.classname || test.suite || ''),
        file: String(test.file || ''),
        status: reportStatus(test.status != null ? test.status : test.state),
      });
    }
  }

  if (!recognised) throw new Error('unsupported test report shape');
  return cases;
}

async function loadConfig(fs, root, config, errors) {
  let fileConfig = {};
  try {
    const target = await fs.resolve(path.join(root, BOARD_REL, 'config.json'));
    const text = await fs.readText(target);
    const parsed = JSON.parse(text.replace(/^\uFEFF/, ''));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      fileConfig = parsed;
    } else if (String(text).trim()) {
      errors.push({ path: `${BOARD_REL}/config.json`, message: 'config.json must be a JSON object' });
    }
  } catch (error) {
    if (!isNotFound(error)) {
      errors.push({ path: `${BOARD_REL}/config.json`, message: errorMessage(error) });
    }
  }
  const explicit = config && typeof config === 'object' && !Array.isArray(config) ? config : {};
  return { ...fileConfig, ...explicit };
}

async function readSnapshotCache(fs, root) {
  try {
    const target = await fs.resolve(path.join(root, CACHE_REL));
    const text = await fs.readText(target);
    const data = JSON.parse(text);
    if (!data || data.version !== 1 || !data.files || typeof data.files !== 'object' || Array.isArray(data.files)) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

async function readBoardItems(fs, root, entries, now, errors, signal) {
  const items = [];
  const mdEntries = entries
    .filter((entry) => entry && entry.type === 'file' && /\.md$/i.test(String(entry.name || '')))
    .slice()
    .sort((a, b) => compareStrings(String(a.name), String(b.name)));

  for (const entry of mdEntries) {
    if (signal && signal.aborted) break;
    const name = String(entry.name);
    const rel = `${BOARD_FILES_REL}/${name}`;
    const id = name.slice(0, -3);
    let text;
    try {
      const target = entry.target || (await fs.resolve(path.join(root, BOARD_FILES_REL, name)));
      text = await fs.readText(target);
    } catch (error) {
      errors.push({ path: rel, message: errorMessage(error) });
      continue;
    }

    const doc = parseBoardDoc(text);
    if (doc.fatal) {
      errors.push({ path: rel, message: doc.errors[0] || 'invalid front matter' });
      continue;
    }
    const metaId = doc.meta && typeof doc.meta.id === 'string' ? doc.meta.id.trim() : '';
    if (metaId && metaId !== id) {
      errors.push({ path: rel, message: `id "${metaId}" does not match file name "${id}"` });
      continue;
    }
    items.push(normalizeItem(doc, { id, path: rel, now }));
  }

  return items;
}

async function collectTestCases(fs, root, config, files, errors, signal) {
  const tests = config && typeof config.tests === 'object' && config.tests ? config.tests : {};
  const junitPatterns = normalizeList(tests.junit);
  const jsonPatterns = normalizeList(tests.json);
  if (!junitPatterns.length && !jsonPatterns.length) return [];

  const cases = [];
  const handled = new Set();

  const readReport = async (file) => {
    try {
      const target = await fs.resolve(path.join(root, file.rel));
      return await fs.readText(target);
    } catch (error) {
      errors.push({ path: file.rel, message: errorMessage(error) });
      return null;
    }
  };

  for (const pattern of junitPatterns) {
    for (const file of files) {
      if ((signal && signal.aborted) || handled.has(file.rel)) continue;
      if (!matchGlob(pattern, file.rel)) continue;
      handled.add(file.rel);
      const text = await readReport(file);
      if (text == null) continue;
      cases.push(...parseJunitXml(text));
    }
  }

  for (const pattern of jsonPatterns) {
    for (const file of files) {
      if ((signal && signal.aborted) || handled.has(file.rel)) continue;
      if (!matchGlob(pattern, file.rel)) continue;
      handled.add(file.rel);
      const text = await readReport(file);
      if (text == null) continue;
      try {
        cases.push(...parseJsonReport(text));
      } catch (error) {
        errors.push({ path: file.rel, message: `invalid test report: ${errorMessage(error)}` });
      }
    }
  }

  return cases;
}

function caseKey(testCase) {
  const classname = String(testCase.classname || '');
  const name = String(testCase.name || '');
  return classname ? `${classname}.${name}` : name;
}

function matchesTestKeywords(item, testCase) {
  const haystack = [caseKey(testCase), String(testCase.file || '')].filter(Boolean).map((value) => value.toLowerCase());
  if (!haystack.length) return false;
  return item.testMatch.some((keyword) => {
    const needle = String(keyword).toLowerCase();
    return needle.length > 0 && haystack.some((value) => value.includes(needle));
  });
}

async function writeSnapshotCache(fs, root, files, items, generatedAt, errors) {
  const filesMap = {};
  const versionByRel = new Map();
  for (const file of files) {
    filesMap[file.rel] = file.version;
    versionByRel.set(file.rel, file.version);
  }
  const itemsMap = {};
  for (const item of items) {
    const version = versionByRel.has(item.path) ? versionByRel.get(item.path) : fallbackVersion(item);
    itemsMap[item.id] = { version, item };
  }
  const payload = { version: 1, files: filesMap, items: itemsMap, generatedAt };
  try {
    const target = await fs.resolve(path.join(root, CACHE_REL));
    await fs.writeText(target, JSON.stringify(payload));
  } catch (error) {
    errors.push({ path: CACHE_REL, message: `cache write failed: ${errorMessage(error)}` });
  }
}

function fallbackVersion(item) {
  let hash = 2166136261;
  const text = JSON.stringify(item);
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `h${(hash >>> 0).toString(16)}`;
}

function buildChanges(previous, items, generatedAt) {
  const previousItems = previous && Array.isArray(previous.items) ? previous.items : null;
  if (!previousItems) return [];

  const changes = [];
  const previousById = new Map();
  for (const item of previousItems) {
    if (item && typeof item === 'object' && item.id) previousById.set(item.id, item);
  }
  const currentIds = new Set(items.map((item) => item.id));

  for (const previousItem of previousItems) {
    if (!previousItem || !previousItem.id || currentIds.has(previousItem.id)) continue;
    changes.push({
      at: generatedAt,
      kind: 'item-missing',
      id: previousItem.id,
      title: previousItem.title || previousItem.id,
    });
  }

  for (const item of items) {
    const previousItem = previousById.get(item.id);
    if (!previousItem) {
      changes.push({ at: generatedAt, kind: 'item-added', id: item.id, title: item.title || item.id });
      continue;
    }

    const previousGates = previousItem.gates && typeof previousItem.gates === 'object' ? previousItem.gates : {};
    const currentGates = item.gates || {};

    if (previousItem.stage !== item.stage
      || previousItem.title !== item.title
      || previousItem.area !== item.area
      || previousItem.priority !== item.priority) {
      changes.push({ at: generatedAt, kind: 'item-updated', id: item.id, title: item.title || item.id });
    }

    if (previousGates.decision !== currentGates.decision) {
      if (currentGates.decision === 'pending') {
        changes.push({ at: generatedAt, kind: 'decision-added', id: item.id, title: item.title || item.id });
      } else if (previousGates.decision === 'pending') {
        changes.push({ at: generatedAt, kind: 'decision-cleared', id: item.id, title: item.title || item.id });
      }
    }

    if (previousGates.manual !== currentGates.manual) {
      if (currentGates.manual === 'pending') {
        changes.push({ at: generatedAt, kind: 'manual-added', id: item.id, title: item.title || item.id });
      } else if (previousGates.manual === 'pending') {
        changes.push({ at: generatedAt, kind: 'manual-cleared', id: item.id, title: item.title || item.id });
      }
    }

    if (previousGates.test !== currentGates.test) {
      if (currentGates.test === 'failing') {
        changes.push({ at: generatedAt, kind: 'test-failed', id: item.id, title: item.title || item.id });
      } else if (previousGates.test === 'failing') {
        changes.push({ at: generatedAt, kind: 'test-fixed', id: item.id, title: item.title || item.id });
      }
    }
  }

  return changes.slice(0, MAX_CHANGES);
}

function applyFileMatches(item, files, previousVersions, generatedAt, scanTruncated) {
  const matched = [];
  if (item.match.length) {
    for (const file of files) {
      if (item.match.some((pattern) => matchGlob(pattern, file.rel))) matched.push(file);
    }
  }

  item.derived.filesMatched = matched.length;
  item.derived.fileList = matched.slice(0, FILE_LIST_LIMIT).map((file) => file.rel);
  item.derived.missing = item.match.length > 0 && matched.length === 0;
  item.derived.truncated = Boolean(scanTruncated) || matched.length > FILE_LIST_LIMIT;

  let lastChangedAt = null;
  if (previousVersions && matched.length) {
    for (const file of matched) {
      const previousVersion = previousVersions[file.rel];
      if (previousVersion === undefined || String(previousVersion) !== String(file.version)) {
        lastChangedAt = generatedAt;
        break;
      }
    }
  }
  item.derived.lastChangedAt = lastChangedAt;
}

function applyTestResults(item, testCases) {
  if (!item.testMatch.length || !testCases.length) return;
  const matched = testCases.filter((testCase) => matchesTestKeywords(item, testCase));
  if (!matched.length) return;

  const failed = matched.filter((testCase) => testCase.status === 'failed').length;
  item.derived.testTotal = matched.length;
  item.derived.testFailed = failed;
  item.derived.testStatus = failed > 0 ? 'failing' : 'passing';
  item.gates.test = item.derived.testStatus;
}

function emptySnapshot({ generatedAt, revision, errors }) {
  return {
    ok: true,
    generatedAt,
    revision,
    board: { dir: BOARD_REL, initialized: false },
    scan: {
      durationMs: 0,
      files: 0,
      truncated: false,
      errors: errors || [],
    },
    counts: ZERO_COUNTS(),
    areas: [],
    items: [],
    changes: [],
  };
}

/**
 * Run a full scan and return a Snapshot.
 *
 * `config` is merged over `.gameboard/config.json` (explicit config wins) so
 * the Host may pass a partial override. A missing/unreadable `.gameboard`
 * yields a valid empty snapshot with `board.initialized === false`.
 */
export async function scanBoard({ fs, root, config, previous, now, signal } = {}) {
  const startedAt = Date.now();
  const generatedAt = isoNow(now);
  const previousRevision = previous && Number.isFinite(Number(previous.revision)) ? Number(previous.revision) : 0;
  const revision = previousRevision + 1;
  const errors = [];

  if (!fs || !root) {
    errors.push({ path: '.', message: 'scanBoard requires an fs adapter and a root path' });
    const snapshot = emptySnapshot({ generatedAt, revision, errors });
    snapshot.scan.durationMs = Date.now() - startedAt;
    return snapshot;
  }

  const mergedConfig = await loadConfig(fs, root, config, errors);

  let boardEntries;
  try {
    const boardTarget = await fs.resolve(path.join(root, BOARD_FILES_REL));
    boardEntries = await fs.listDir(boardTarget);
  } catch (error) {
    if (!isNotFound(error)) errors.push({ path: `${BOARD_REL}/board`, message: errorMessage(error) });
    const snapshot = emptySnapshot({ generatedAt, revision, errors });
    snapshot.scan.durationMs = Date.now() - startedAt;
    return snapshot;
  }
  if (!Array.isArray(boardEntries)) boardEntries = [];

  const collected = await collectFiles({
    fs,
    root,
    exclude: mergedConfig.exclude,
    maxFiles: mergedConfig.maxFiles,
    signal,
  });
  errors.push(...collected.errors);

  const cache = await readSnapshotCache(fs, root);
  const previousVersions = cache && cache.files ? cache.files : null;

  const items = await readBoardItems(fs, root, boardEntries, generatedAt, errors, signal);
  const testCases = await collectTestCases(fs, root, mergedConfig, collected.files, errors, signal);

  for (const item of items) {
    applyFileMatches(item, collected.files, previousVersions, generatedAt, collected.truncated);
    applyTestResults(item, testCases);
  }

  const { counts, areas } = summarize(items);
  const changes = buildChanges(previous, items, generatedAt);

  await writeSnapshotCache(fs, root, collected.files, items, generatedAt, errors);

  return {
    ok: true,
    generatedAt,
    revision,
    board: { dir: BOARD_REL, initialized: true },
    scan: {
      durationMs: Date.now() - startedAt,
      files: collected.files.length,
      truncated: collected.truncated,
      errors,
    },
    counts,
    areas,
    items,
    changes,
  };
}
