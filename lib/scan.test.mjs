import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DECISION,
  MANUAL,
  PRIORITIES,
  STAGES,
  TEST,
  digest,
  emptyItem,
  normalizeItem,
  parseBoardDoc,
  serializeItem,
  slugId,
  summarize,
} from './board.js';
import {
  collectFiles,
  matchGlob,
  parseJsonReport,
  parseJunitXml,
  scanBoard,
} from './scan.js';

const ROOT = 'C:/repo';
const NOW = '2026-11-05T12:00:00.000Z';
const LATER = '2026-11-05T13:00:00.000Z';

function normalizePath(value) {
  let result = String(value).replace(/\\/g, '/').replace(/\/+/g, '/');
  if (result.length > 1 && result.endsWith('/')) result = result.slice(0, -1);
  return result;
}

/**
 * Tiny in-memory FsAdapter. Keys are normalised absolute POSIX paths.
 * Directories are inferred from file paths plus explicitly created empty dirs.
 */
function createMemoryFs(seed = {}) {
  const files = new Map();
  const dirs = new Set();
  let versionCounter = 0;

  const nextVersion = () => {
    versionCounter += 1;
    return `v${versionCounter}`;
  };

  const add = (key, content, version) => {
    const normalized = normalizePath(key);
    files.set(normalized, { content: String(content), version: version || nextVersion() });
    const parts = normalized.split('/');
    for (let i = 1; i < parts.length; i += 1) {
      dirs.add(parts.slice(0, i).join('/'));
    }
  };

  for (const [key, value] of Object.entries(seed)) {
    if (value && typeof value === 'object' && 'content' in value) add(key, value.content, value.version);
    else add(key, value);
  }

  const adapter = {
    files,
    addDir(key) {
      const normalized = normalizePath(key);
      dirs.add(normalized);
      const parts = normalized.split('/');
      for (let i = 1; i < parts.length; i += 1) dirs.add(parts.slice(0, i).join('/'));
    },
    setFile(key, content, version) {
      add(key, content, version);
    },
    readFile(key) {
      const entry = files.get(normalizePath(key));
      return entry ? entry.content : undefined;
    },
    async resolve(target) {
      return { path: normalizePath(target) };
    },
    async listDir(target) {
      const base = normalizePath(target.path);
      if (!dirs.has(base)) {
        const error = new Error(`ENOENT: no such file or directory, ${base}`);
        error.code = 'ENOENT';
        throw error;
      }
      const prefix = `${base}/`;
      const children = new Map();

      for (const key of files.keys()) {
        if (!key.startsWith(prefix)) continue;
        const rest = key.slice(prefix.length);
        const slash = rest.indexOf('/');
        const name = slash === -1 ? rest : rest.slice(0, slash);
        if (children.has(name)) continue;
        const childPath = `${prefix}${name}`;
        if (slash === -1) {
          const entry = files.get(key);
          children.set(name, {
            name,
            type: 'file',
            target: { path: childPath },
            version: entry.version,
            size: entry.content.length,
          });
        } else {
          children.set(name, { name, type: 'directory', target: { path: childPath }, version: '', size: 0 });
        }
      }

      for (const dir of dirs) {
        if (!dir.startsWith(prefix)) continue;
        const rest = dir.slice(prefix.length);
        if (!rest || rest.includes('/')) continue;
        if (!children.has(rest)) {
          children.set(rest, {
            name: rest,
            type: 'directory',
            target: { path: dir },
            version: '',
            size: 0,
          });
        }
      }

      return [...children.values()];
    },
    async readText(target) {
      const key = normalizePath(target.path);
      const entry = files.get(key);
      if (!entry) {
        const error = new Error(`ENOENT: no such file, ${key}`);
        error.code = 'ENOENT';
        throw error;
      }
      return entry.content;
    },
    async writeText(target, text) {
      add(target.path, text);
    },
  };

  return adapter;
}

function boardText(id, fields = {}, body = '') {
  const meta = {
    id,
    title: id,
    area: '战斗',
    stage: 'idea',
    priority: 'normal',
    owner: 'ai',
    ...fields,
  };
  const lines = ['---'];
  for (const [key, value] of Object.entries(meta)) {
    if (key === '__body') continue;
    lines.push(`${key}: ${Array.isArray(value) ? JSON.stringify(value) : value}`);
  }
  lines.push('---', '');
  if (body) lines.push(body);
  return lines.join('\n');
}

test('parseBoardDoc/serializeItem round-trip keeps metadata, unknown keys, and notes', () => {
  const source = [
    '---',
    'id: combat.damage-formula',
    'title: 伤害公式与护甲减伤',
    'area: 战斗',
    'stage: built',
    'priority: high',
    'owner: ai',
    'decision: pending',
    'decision_question: 暴击是否采用乘法叠加？',
    'decision_options: ["乘法叠加", "加法叠加", "只取最高"]',
    'decision_impact: 影响全部数值平衡',
    'decision_deadline: 2026-11-12',
    'manual: none',
    'test: failing',
    'test_match: ["combat"]',
    'match: ["src/combat/**", "docs/design/combat*.md"]',
    'tags: ["数值"]',
    'links: ["https://example.com/design"]',
    'created_at: 2026-11-01T10:00:00.000Z',
    'updated_at: 2026-11-05T12:00:00.000Z',
    'updated_by: workstation-A',
    'custom_flag: keep-me',
    '---',
    '',
    '## 备注',
    '',
    '自由文本。',
  ].join('\n');

  const doc = parseBoardDoc(source);
  assert.equal(doc.fatal, false);
  assert.deepEqual(doc.errors, []);
  assert.equal(doc.meta.custom_flag, 'keep-me');
  assert.deepEqual(doc.meta.decision_options, ['乘法叠加', '加法叠加', '只取最高']);
  assert.deepEqual(doc.meta.match, ['src/combat/**', 'docs/design/combat*.md']);
  assert.equal(doc.body, '## 备注\n\n自由文本。');

  const item = normalizeItem(doc, {
    id: 'combat.damage-formula',
    path: '.gameboard/board/combat.damage-formula.md',
    now: NOW,
  });
  assert.equal(item.stage, 'built');
  assert.equal(item.priority, 'high');
  assert.equal(item.gates.decision, 'pending');
  assert.equal(item.gates.test, 'failing');
  assert.equal(item.decision.question, '暴击是否采用乘法叠加？');
  assert.equal(item.rawMeta.custom_flag, 'keep-me');
  assert.equal(item.errors.length, 0);

  const serialized = serializeItem(item);
  assert.equal(serializeItem(doc), serialized);
  const reparsed = normalizeItem(parseBoardDoc(serialized), {
    id: 'combat.damage-formula',
    path: '.gameboard/board/combat.damage-formula.md',
    now: NOW,
  });
  assert.deepEqual(reparsed, item);
  assert.equal(reparsed.notes, item.notes);
  assert.equal(serializeItem(reparsed), serialized);
});

test('parseBoardDoc is tolerant of missing fences, malformed arrays, unknown fields, and bad enums', () => {
  const noFence = parseBoardDoc('just a body\n');
  assert.equal(noFence.fatal, true);
  assert.equal(noFence.body, 'just a body\n');
  assert.ok(noFence.errors.length > 0);

  const doc = parseBoardDoc(
    ['---', 'id: broken', 'tags: ["a", "b"', 'stage: nonsense', '---', '', 'body'].join('\n'),
  );
  assert.equal(doc.fatal, false);
  assert.ok(doc.errors.some((message) => /unterminated array/.test(message)));
  assert.deepEqual(doc.meta.tags, ['a', 'b']);
  assert.equal(doc.body, 'body');

  const emptyArrayDoc = parseBoardDoc(['---', 'id: empty', 'tags: []', 'match: [a, b]', '---', ''].join('\n'));
  assert.deepEqual(emptyArrayDoc.meta.tags, []);
  assert.deepEqual(emptyArrayDoc.meta.match, ['a', 'b']);
  assert.deepEqual(emptyArrayDoc.errors, []);

  const item = normalizeItem(doc, { id: 'broken', now: NOW });
  assert.equal(item.stage, 'idea');
  assert.ok(item.errors.some((message) => /stage/.test(message)));

  const mismatch = normalizeItem({ meta: { id: 'other' }, body: '' }, { id: 'real', now: NOW });
  assert.ok(mismatch.errors.some((message) => /does not match/.test(message)));

  // enum exports stay in sync with the contract
  assert.deepEqual(STAGES, ['idea', 'spec', 'building', 'built', 'tested', 'shipped']);
  assert.deepEqual(DECISION, ['none', 'pending', 'decided']);
  assert.deepEqual(MANUAL, ['none', 'pending', 'done']);
  assert.deepEqual(TEST, ['untested', 'failing', 'passing']);
  assert.deepEqual(PRIORITIES, ['low', 'normal', 'high', 'urgent']);
});

test('slugId and emptyItem apply documented defaults', () => {
  assert.equal(slugId('Combat', 'Damage Formula!'), 'combat.damage-formula');
  assert.equal(slugId('', ''), 'item');

  const item = emptyItem({ title: 'New Thing', area: 'Combat', now: NOW });
  assert.equal(item.id, 'combat.new-thing');
  assert.equal(item.stage, 'idea');
  assert.equal(item.gates.test, 'untested');
  assert.equal(item.createdAt, NOW);
  assert.equal(item.updatedAt, NOW);
  assert.equal(item.path, '.gameboard/board/combat.new-thing.md');
  assert.deepEqual(item.derived, {
    filesMatched: 0,
    fileList: [],
    lastChangedAt: null,
    testStatus: null,
    testTotal: 0,
    testFailed: 0,
    missing: false,
    truncated: false,
  });
});

test('glob matching supports **, *, ? and does not cross path separators with *', () => {
  assert.equal(matchGlob('src/combat/**', 'src/combat/a/b.ts'), true);
  assert.equal(matchGlob('src/combat/**', 'src/combat/a.ts'), true);
  assert.equal(matchGlob('**/*.md', 'docs/design/combat.md'), true);
  assert.equal(matchGlob('**/*.md', 'combat.md'), true);
  assert.equal(matchGlob('src/*.ts', 'src/combat/a.ts'), false);
  assert.equal(matchGlob('src/combat/?.ts', 'src/combat/a.ts'), true);
  assert.equal(matchGlob('src/combat/?.ts', 'src/combat/ab.ts'), false);
});

test('collectFiles prunes built-in directories, respects exclude globs, and reports truncation', async () => {
  const fs = createMemoryFs({
    'C:/repo/src/combat/a.ts': 'a',
    'C:/repo/src/combat/sub/b.ts': 'b',
    'C:/repo/src/combat/deep/x/y.ts': 'y',
    'C:/repo/docs/combat.md': 'doc',
    'C:/repo/node_modules/pkg/index.js': 'nm',
    'C:/repo/dist/out.js': 'dist',
    'C:/repo/build/out.js': 'build',
    'C:/repo/.git/config': 'git',
    'C:/repo/.gameboard/.cache/snapshot.json': '{}',
    'C:/repo/.gameboard/board/a.md': '---\nid: a\n---\n\n',
  });

  const collected = await collectFiles({ fs, root: ROOT });
  assert.deepEqual(collected.files.map((file) => file.rel), [
    '.gameboard/board/a.md',
    'docs/combat.md',
    'src/combat/a.ts',
    'src/combat/deep/x/y.ts',
    'src/combat/sub/b.ts',
  ]);
  assert.equal(collected.truncated, false);
  assert.deepEqual(collected.errors, []);

  const excluded = await collectFiles({ fs, root: ROOT, exclude: ['docs/**', '**/*.md'] });
  assert.deepEqual(excluded.files.map((file) => file.rel), [
    'src/combat/a.ts',
    'src/combat/deep/x/y.ts',
    'src/combat/sub/b.ts',
  ]);

  const truncated = await collectFiles({ fs, root: ROOT, maxFiles: 2 });
  assert.equal(truncated.truncated, true);
  assert.equal(truncated.files.length, 2);
});

test('parseJunitXml parses testcase attributes and failure/error children', () => {
  const xml = [
    '<testsuites>',
    '  <testsuite name="combat">',
    '    <testcase classname="combat.Math" name="adds" file="src/combat/math.test.ts" time="0.01"/>',
    '    <testcase classname="combat.Math" name="subtracts" file="src/combat/math.test.ts">',
    '      <failure message="boom">expected 1</failure>',
    '    </testcase>',
    '    <testcase classname="combat.Math" name="errors" file="src/combat/math.test.ts">',
    '      <error message="kaboom"/>',
    '    </testcase>',
    '  </testsuite>',
    '</testsuites>',
  ].join('\n');

  const cases = parseJunitXml(xml);
  assert.deepEqual(cases, [
    { name: 'adds', classname: 'combat.Math', file: 'src/combat/math.test.ts', status: 'passed' },
    { name: 'subtracts', classname: 'combat.Math', file: 'src/combat/math.test.ts', status: 'failed' },
    { name: 'errors', classname: 'combat.Math', file: 'src/combat/math.test.ts', status: 'failed' },
  ]);
});

test('parseJsonReport accepts vitest and jest shaped reports', () => {
  const vitest = parseJsonReport({
    testResults: [
      {
        name: 'src/combat/math.test.ts',
        assertionResults: [
          { title: 'adds', status: 'passed' },
          { title: 'subtracts', status: 'failed' },
        ],
      },
    ],
  });
  assert.equal(vitest.length, 2);
  assert.equal(vitest[0].file, 'src/combat/math.test.ts');
  assert.equal(vitest[1].status, 'failed');

  const simple = parseJsonReport({ tests: [{ name: 'combat adds', status: 'failed' }] });
  assert.deepEqual(simple, [
    { name: 'combat adds', classname: '', file: '', status: 'failed' },
  ]);

  assert.throws(() => parseJsonReport({ nothing: true }), /unsupported test report shape/);
});

test('scanBoard computes counts, areas, missing items, and writes the cache', async () => {
  const fs = createMemoryFs({
    'C:/repo/src/combat/a.ts': 'combat',
    'C:/repo/.gameboard/board/combat.md': boardText('combat', {
      title: '战斗系统',
      area: '战斗',
      stage: 'built',
      decision: 'pending',
      test: 'passing',
      match: ['src/combat/**'],
    }),
    'C:/repo/.gameboard/board/story.md': boardText('story', {
      title: '剧情',
      area: '剧情',
      stage: 'idea',
      manual: 'pending',
      test: 'failing',
      match: ['nope/**'],
    }),
    'C:/repo/.gameboard/board/ui.md': boardText('ui', {
      title: '界面',
      area: '战斗',
      stage: 'tested',
      decision: 'pending',
      manual: 'pending',
      test: 'untested',
      match: ['src/**/*.ts'],
    }),
  });

  const snapshot = await scanBoard({ fs, root: ROOT, now: NOW });
  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.board.initialized, true);
  assert.equal(snapshot.revision, 1);
  assert.equal(snapshot.generatedAt, NOW);
  assert.deepEqual(snapshot.scan.errors, []);
  assert.equal(snapshot.scan.truncated, false);
  assert.equal(snapshot.scan.files, 4); // three board docs + src/combat/a.ts

  assert.deepEqual(snapshot.counts, {
    total: 3,
    built: 2,
    tested: 1,
    decisionPending: 2,
    manualPending: 2,
    testFailing: 1,
    missing: 1,
  });

  assert.deepEqual(snapshot.areas, [
    { name: '战斗', total: 2, built: 2, tested: 1, pending: 2 },
    { name: '剧情', total: 1, built: 0, tested: 0, pending: 1 },
  ]);

  const combat = snapshot.items.find((item) => item.id === 'combat');
  assert.equal(combat.derived.filesMatched, 1);
  assert.deepEqual(combat.derived.fileList, ['src/combat/a.ts']);
  assert.equal(combat.derived.missing, false);

  const story = snapshot.items.find((item) => item.id === 'story');
  assert.equal(story.derived.filesMatched, 0);
  assert.equal(story.derived.missing, true);

  const summary = summarize(snapshot.items);
  assert.deepEqual(summary.counts, snapshot.counts);
  assert.deepEqual(summary.areas, snapshot.areas);

  const cache = JSON.parse(fs.readFile('C:/repo/.gameboard/.cache/snapshot.json'));
  assert.equal(cache.version, 1);
  assert.equal(typeof cache.files['src/combat/a.ts'], 'string');
  assert.equal(cache.items.combat.item.title, '战斗系统');
  assert.equal(cache.generatedAt, NOW);

  const text = digest(snapshot.items);
  assert.ok(text.length <= 900);
  assert.match(text, /待拍板 2/);
});

test('scanBoard derives test status from junit reports and only from matched cases', async () => {
  const fs = createMemoryFs({
    'C:/repo/src/combat/a.ts': 'combat',
    'C:/repo/reports/junit/result.xml': [
      '<testsuites><testsuite>',
      '<testcase classname="combat.Math" name="adds" file="src/combat/math.test.ts"/>',
      '<testcase classname="combat.Math" name="subtracts" file="src/combat/math.test.ts"><failure/></testcase>',
      '<testcase classname="shop.Cart" name="totals" file="src/shop/cart.test.ts"/>',
      '</testsuite></testsuites>',
    ].join(''),
    'C:/repo/.gameboard/board/combat.md': boardText('combat', {
      title: '战斗',
      area: '战斗',
      stage: 'built',
      test: 'passing',
      test_match: ['combat'],
      match: ['src/combat/**'],
    }),
    'C:/repo/.gameboard/board/shop.md': boardText('shop', {
      title: '商店',
      area: '系统',
      stage: 'built',
      test: 'untested',
      test_match: ['shop'],
    }),
    'C:/repo/.gameboard/board/other.md': boardText('other', {
      title: '其他',
      area: '系统',
      stage: 'idea',
      test: 'failing',
      test_match: ['no-such-suite'],
    }),
  });

  const snapshot = await scanBoard({
    fs,
    root: ROOT,
    now: NOW,
    config: { tests: { junit: ['reports/junit/*.xml'] } },
  });

  const combat = snapshot.items.find((item) => item.id === 'combat');
  assert.equal(combat.derived.testStatus, 'failing');
  assert.equal(combat.derived.testTotal, 2);
  assert.equal(combat.derived.testFailed, 1);
  assert.equal(combat.gates.test, 'failing');

  const shop = snapshot.items.find((item) => item.id === 'shop');
  assert.equal(shop.derived.testStatus, 'passing');
  assert.equal(shop.gates.test, 'passing');

  // Report exists but this item matches no case: preserve the declared value,
  // do not invent failing/passing.
  const other = snapshot.items.find((item) => item.id === 'other');
  assert.equal(other.derived.testStatus, null);
  assert.equal(other.derived.testTotal, 0);
  assert.equal(other.gates.test, 'failing');

  // `combat` is failing (derived) and `other` keeps its declared failing gate;
  // `shop` is passing. A report that matches nothing must not invent a status.
  assert.equal(snapshot.counts.testFailing, 2);
  assert.equal(snapshot.counts.tested, 1);
});

test('cache drives lastChangedAt and a corrupt cache is treated as absent', async () => {
  const fs = createMemoryFs({
    'C:/repo/src/combat/a.ts': { content: 'v1', version: 'v1' },
    'C:/repo/.gameboard/board/combat.md': boardText('combat', {
      title: '战斗',
      match: ['src/combat/**'],
    }),
  });

  const first = await scanBoard({ fs, root: ROOT, now: NOW });
  assert.equal(first.items[0].derived.lastChangedAt, null);

  fs.setFile('C:/repo/src/combat/a.ts', 'v2', 'v2');
  const second = await scanBoard({ fs, root: ROOT, previous: first, now: LATER });
  assert.equal(second.revision, 2);
  assert.equal(second.items[0].derived.lastChangedAt, LATER);

  // A corrupt cache must not throw and must not produce a bogus change time.
  fs.setFile('C:/repo/.gameboard/.cache/snapshot.json', '{not-json', 'bad');
  const third = await scanBoard({ fs, root: ROOT, previous: second, now: LATER });
  assert.equal(third.ok, true);
  assert.equal(third.items[0].derived.lastChangedAt, null);
});

test('changes include test-failed and decision-added transitions', async () => {
  const fs = createMemoryFs({
    'C:/repo/.gameboard/board/combat.md': boardText('combat', {
      title: '战斗',
      stage: 'built',
      test: 'passing',
      decision: 'none',
    }),
  });

  const first = await scanBoard({ fs, root: ROOT, now: NOW });
  assert.deepEqual(first.changes, []);

  fs.setFile('C:/repo/.gameboard/board/combat.md', boardText('combat', {
    title: '战斗',
    stage: 'built',
    test: 'failing',
    decision: 'pending',
  }), 'changed');

  const second = await scanBoard({ fs, root: ROOT, previous: first, now: LATER });
  const kinds = second.changes.map((change) => change.kind);
  assert.ok(kinds.includes('test-failed'));
  assert.ok(kinds.includes('decision-added'));
  assert.equal(second.changes.every((change) => change.id === 'combat'), true);
  assert.equal(second.changes.every((change) => change.at === LATER), true);
});

test('missing .gameboard returns initialized:false without throwing', async () => {
  const fs = createMemoryFs({});
  const snapshot = await scanBoard({ fs, root: ROOT, now: NOW });
  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.board.initialized, false);
  assert.equal(snapshot.revision, 1);
  assert.deepEqual(snapshot.items, []);
  assert.deepEqual(snapshot.areas, []);
  assert.deepEqual(snapshot.changes, []);
  assert.equal(snapshot.scan.files, 0);
  assert.deepEqual(snapshot.counts, {
    total: 0,
    built: 0,
    tested: 0,
    decisionPending: 0,
    manualPending: 0,
    testFailing: 0,
    missing: 0,
  });
});

test('bad board files are reported and skipped without failing the scan', async () => {
  const fs = createMemoryFs({
    'C:/repo/.gameboard/board/good.md': boardText('good', { title: '好' }),
    'C:/repo/.gameboard/board/nofront.md': 'just notes\n',
    'C:/repo/.gameboard/board/mismatch.md': boardText('different', { title: '错位' }),
    'C:/repo/.gameboard/board/unclosed.md': '---\nid: unclosed\n',
  });

  const snapshot = await scanBoard({ fs, root: ROOT, now: NOW });
  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.board.initialized, true);
  assert.deepEqual(snapshot.items.map((item) => item.id), ['good']);

  const paths = snapshot.scan.errors.map((error) => error.path);
  assert.ok(paths.includes('.gameboard/board/nofront.md'));
  assert.ok(paths.includes('.gameboard/board/mismatch.md'));
  assert.ok(paths.includes('.gameboard/board/unclosed.md'));
});
