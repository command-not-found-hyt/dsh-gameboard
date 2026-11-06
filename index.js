/**
 * Gameboard: a file-driven project status board shared by every terminal and machine.
 *
 * The board lives inside the game repository (`.gameboard/`), so git carries it
 * between machines. This Host half owns scanning, writes, the HTTP surface the
 * panel reads, and the `gameboard` tool the agent uses.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { hostname } from 'node:os';
import { basename, dirname, join } from 'node:path';

import {
  PRIORITIES,
  STAGES,
  digest,
  emptyItem,
  normalizeItem,
  parseBoardDoc,
  serializeItem,
  slugId,
  summarize,
  timelineEvents,
  timelineInsights,
} from './lib/board.js';
import { attachGit, readGitLog } from './lib/git.js';
import { scanBoard } from './lib/scan.js';

export const inject = ['fs', 'tools', 'timer'];

const DEFAULTS = {
  boardDir: '.gameboard',
  root: '',
  scanIntervalSec: 60,
  watch: true,
  promptDigest: true,
  maxFiles: 20000,
  machine: '',
  git: true,
  gitBin: 'git',
};

const TOOL_AREA_LIMIT = 40;

function emptySnapshot(dir) {
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    revision: 0,
    board: { dir, initialized: false },
    scan: { durationMs: 0, files: 0, truncated: false, errors: [] },
    counts: {
      total: 0,
      built: 0,
      tested: 0,
      decisionPending: 0,
      manualPending: 0,
      testFailing: 0,
      missing: 0,
    },
    areas: [],
    items: [],
    changes: [],
    activeRoot: '',
    repos: [],
    git: { available: false, commits: 0 },
    insights: { transitions: [], slow: [], stalled: [] },
  };
}

function errorText(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readHeader(req, name) {
  const value = req.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * True for requests a same-origin page made. The token endpoint relies on this
 * instead of a token: a browser sends `Sec-Fetch-Site`, and cross-origin script
 * cannot read the JSON answer without CORS headers.
 */
function isSameOrigin(req, webServer) {
  const origin = readHeader(req, 'origin');
  let expected = '';
  try {
    expected = webServer.getOrigin();
  } catch {
    expected = '';
  }
  if (origin && expected && origin === expected) return true;
  if (readHeader(req, 'sec-fetch-site') === 'same-origin') return true;
  return false;
}

async function readBody(req, limit = 1 << 20) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('request body too large');
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text.trim()) return {};
  return JSON.parse(text);
}

/**
 * Machine-local settings, kept outside the repository so the shipped bundle
 * patch stays generic: `<profile>/gameboard.json`, e.g. `{"root": "D:\\MyGame"}`.
 * The patch row's `config` wins over this file.
 */
function profileDirectory() {
  const fromEnv = process.env.DSH_PROFILE_DIR;
  if (fromEnv) return fromEnv;
  const home = process.env.USERPROFILE || process.env.HOME;
  if (!home) return undefined;
  return join(home, '.dsh', 'profiles', process.env.DSH_PROFILE || 'desktop');
}

function readMachineConfig() {
  const dir = profileDirectory();
  if (!dir) return {};
  try {
    // A BOM is legal for editors to write and fatal to JSON.parse; strip it.
    const text = readFileSync(join(dir, 'gameboard.json'), 'utf8').replace(/^\uFEFF/, '');
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function resolveRoot(ctx, settings) {
  const explicit = settings.root || process.env.GAMEBOARD_ROOT;
  if (explicit) return String(explicit);
  try {
    const registry = ctx.get('workspaceRegistry');
    const workspaces = registry && typeof registry.list === 'function' ? registry.list() : [];
    for (const workspace of workspaces) {
      if (workspace && typeof workspace.path === 'string' && workspace.path) return workspace.path;
    }
  } catch {
    // fall through to the process default
  }
  return ctx.get('workingDirectory')?.defaultDirectory || process.cwd();
}

export function apply(ctx, config = {}) {
  const settings = { ...DEFAULTS, ...readMachineConfig(), ...(config || {}) };
  const machine =
    String(settings.machine || process.env.GAMEBOARD_MACHINE || hostname() || 'unknown').trim() ||
    'unknown';
  // A configured token lets headless callers (scripts, other machines) drive the
  // board; otherwise each Host process gets a fresh random one injected into the
  // panel page.
  const token = String(settings.token || '').trim() || randomUUID();
  const boardRel = String(settings.boardDir || '.gameboard')
    .replace(/\\/g, '/')
    .replace(/\/+$/, '');
  let activeRoot = resolveRoot(ctx, settings);
  const boardDir = () => join(activeRoot, boardRel);
  const itemsRel = `${boardRel}/board`;
  const configRel = `${boardRel}/config.json`;
  // Writes are fenced to the active repository: the composed filesystem's
  // default policy points at the profile directory, not at the game repo.
  const boardPolicy = () => ({ mode: 'workspace-write', workspaceRoot: activeRoot });

  let snapshot = emptySnapshot(boardDir());
  snapshot.activeRoot = activeRoot;
  let scanPromise = null;
  let disposed = false;
  let watchTimer = null;
  let lastError = null;

  const adapter = {
    resolve: (path, opts) => ctx.fs.resolve(path, opts),
    listDir: (target) => ctx.fs.listDir(target),
    readText: (target) => ctx.fs.readText(target),
    writeText: (target, text, expected, signal) =>
      ctx.fs.writeText(target, text, expected, signal, boardPolicy()),
  };

  function pathKey(value) {
    return String(value || '')
      .replace(/\\/g, '/')
      .replace(/\/+$/, '')
      .toLowerCase();
  }

  /** Every repository the panel may switch to: active, configured, workspaces. */
  function repoEntries() {
    const candidates = [];
    const push = (value) => {
      if (typeof value === 'string' && value.trim()) candidates.push(value.trim());
    };
    push(activeRoot);
    for (const root of Array.isArray(settings.roots) ? settings.roots : []) push(root);
    try {
      const registry = ctx.get('workspaceRegistry');
      const workspaces = registry && typeof registry.list === 'function' ? registry.list() : [];
      for (const workspace of workspaces) push(workspace && workspace.path);
    } catch {
      // workspaces are an optional convenience
    }
    const seen = new Set();
    return candidates.filter((root) => {
      const key = pathKey(root);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async function describeRepo(root) {
    const entry = {
      root,
      label: basename(root) || root,
      initialized: false,
      itemCount: 0,
      active: pathKey(root) === pathKey(activeRoot),
    };
    try {
      const target = await ctx.fs.resolve(join(root, itemsRel));
      const entries = await ctx.fs.listDir(target);
      const files = (Array.isArray(entries) ? entries : []).filter(
        (item) => item && item.type === 'file' && String(item.name).endsWith('.md'),
      );
      entry.initialized = true;
      entry.itemCount = files.length;
    } catch {
      // no board in that repository yet
    }
    return entry;
  }

  async function describeRepos() {
    return Promise.all(repoEntries().map((root) => describeRepo(root)));
  }

  function persistMachineConfig(patch) {
    const dir = profileDirectory();
    if (!dir) return;
    try {
      const current = readMachineConfig();
      const next = { ...current, ...patch };
      writeFileSync(join(dir, 'gameboard.json'), `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    } catch (error) {
      console.warn('[gameboard] could not persist machine config:', error);
    }
  }

  async function selectRoot(root) {
    const next = String(root || '').trim();
    if (!next) throw new Error('缺少仓库路径');
    let info;
    try {
      const target = await ctx.fs.resolve(next);
      info = await ctx.fs.stat(target);
    } catch (error) {
      throw new Error(`无法访问仓库：${next}（${errorText(error)}）`);
    }
    if (!info || info.type !== 'directory') throw new Error(`不是目录：${next}`);
    const previous = activeRoot;
    activeRoot = next;
    settings.roots = [next, ...(Array.isArray(settings.roots) ? settings.roots : [])].filter(
      (value) => typeof value === 'string' && value.trim(),
    );
    persistMachineConfig({ activeRoot: next, roots: settings.roots });
    snapshot = { ...snapshot, activeRoot: next, board: { ...snapshot.board, dir: boardDir() } };
    if (pathKey(previous) !== pathKey(next)) {
      snapshot.items = [];
      snapshot.changes = [];
    }
    return refresh();
  }

  async function runScan() {
    if (disposed) return snapshot;
    if (scanPromise) return scanPromise;
    const startedAt = Date.now();
    scanPromise = (async () => {
      try {
        const next = await scanBoard({
          fs: adapter,
          root: activeRoot,
          config: settings.maxFiles === DEFAULTS.maxFiles ? {} : { maxFiles: settings.maxFiles },
          previous: snapshot,
          now: new Date().toISOString(),
        });
        if (disposed) return snapshot;
        next.ok = true;
        next.generatedAt = new Date().toISOString();
        next.board = { ...next.board, dir: boardDir() };
        next.activeRoot = activeRoot;
        next.repos = await describeRepos();
        // Git is optional: one log read per scan, attached per work item.
        let gitInfo = { available: false, commits: 0 };
        if (settings.git !== false) {
          const commits = await readGitLog({
            root: activeRoot,
            gitBin: settings.gitBin || 'git',
          });
          if (commits) {
            for (const item of next.items) attachGit(item, commits);
            gitInfo = { available: true, commits: commits.length };
          }
        }
        next.git = gitInfo;
        next.insights = timelineInsights(next.items);
        next.scan = {
          ...next.scan,
          durationMs: Date.now() - startedAt,
        };
        lastError = null;
        snapshot = next;
        return snapshot;
      } catch (error) {
        lastError = errorText(error);
        console.warn('[gameboard] scan failed:', error);
        snapshot = {
          ...snapshot,
          activeRoot,
          generatedAt: new Date().toISOString(),
          scan: {
            ...(snapshot.scan || { durationMs: 0, files: 0, truncated: false, errors: [] }),
            durationMs: Date.now() - startedAt,
            errors: [
              ...((snapshot.scan && snapshot.scan.errors) || []),
              { path: boardDir(), message: lastError },
            ].slice(-20),
          },
        };
        return snapshot;
      } finally {
        scanPromise = null;
      }
    })();
    return scanPromise;
  }

  function scheduleScan(delay = 0) {
    if (disposed) return;
    if (watchTimer !== null) clearTimeout(watchTimer);
    watchTimer = setTimeout(() => {
      watchTimer = null;
      runScan().catch((error) => console.warn('[gameboard] rescan failed:', error));
    }, delay);
  }

  async function refresh() {
    await runScan();
    return snapshot;
  }

  // ---- board file IO -------------------------------------------------------

  async function ensureDir(relDir) {
    const abs = join(activeRoot, relDir);
    try {
      await mkdir(abs, { recursive: true });
    } catch (error) {
      if (error && error.code !== 'EEXIST') throw error;
    }
    return abs;
  }

  async function readItemFile(id) {
    const item = snapshot.items.find((entry) => entry.id === id);
    if (!item) throw new Error(`未知工作项：${id}`);
    const target = await ctx.fs.resolve(item.path, { cwd: activeRoot });
    const text = await ctx.fs.readText(target);
    const doc = parseBoardDoc(text);
    return { item, doc, text };
  }

  async function writeItem(item) {
    if (!item.path) item.path = `${itemsRel}/${item.id}.md`;
    await ensureDir(dirname(item.path.replace(/\\/g, '/')));
    const target = await ctx.fs.resolve(item.path, { cwd: activeRoot });
    await ctx.fs.writeText(target, serializeItem(item), undefined, undefined, boardPolicy());
  }

  const STAGE_SEQUENCE = ['idea', 'spec', 'building', 'built', 'tested', 'shipped'];

  /** Record a milestone once; later writes must not move it backwards. */
  function stampMilestone(item, key, at) {
    if (!item.milestones || typeof item.milestones !== 'object') item.milestones = {};
    if (!item.milestones[key]) item.milestones[key] = at;
  }

  function stampStageProgress(item, previousStage, at) {
    const from = STAGE_SEQUENCE.indexOf(previousStage);
    const to = STAGE_SEQUENCE.indexOf(item.stage);
    if (to <= from) return;
    if (to >= STAGE_SEQUENCE.indexOf('building')) stampMilestone(item, 'startedAt', at);
    if (to >= STAGE_SEQUENCE.indexOf('built')) stampMilestone(item, 'builtAt', at);
    if (to >= STAGE_SEQUENCE.indexOf('tested')) stampMilestone(item, 'testedAt', at);
    if (to >= STAGE_SEQUENCE.indexOf('shipped')) stampMilestone(item, 'shippedAt', at);
  }

  async function mutateItem(id, change, options = {}) {
    const { item, doc } = await readItemFile(id);
    const next = normalizeItem(
      { meta: { ...doc.meta }, body: doc.body },
      { id: item.id, path: item.path, now: new Date().toISOString() },
    );
    const before = {
      stage: next.stage,
      test: next.gates.test,
      decision: next.gates.decision,
      manual: next.gates.manual,
    };
    const nowIso = new Date().toISOString();
    const result = change(next, options) || next;
    stampStageProgress(result, before.stage, nowIso);
    if (before.test !== 'passing' && result.gates.test === 'passing') {
      stampMilestone(result, 'testedAt', nowIso);
    }
    if (before.decision !== 'decided' && result.gates.decision === 'decided') {
      stampMilestone(result, 'decidedAt', nowIso);
    }
    if (before.manual !== 'done' && result.gates.manual === 'done') {
      stampMilestone(result, 'manualDoneAt', nowIso);
    }
    result.updatedAt = nowIso;
    result.updatedBy = options.by || `${machine}/user`;
    await writeItem(result);
    return refresh();
  }

  async function createItem(input) {
    await ensureDir(itemsRel);
    const title = String(input.title || '').trim();
    if (!title) throw new Error('新增工作项需要 title');
    const area = String(input.area || '未分类').trim() || '未分类';
    let base = String(input.id || '').trim() || slugId(area, title);
    base = base.replace(/[^a-zA-Z0-9._\-\u4e00-\u9fa5]/g, '-').replace(/^-+|-+$/g, '');
    if (!base) base = slugId(area, title);
    let candidate = base;
    let suffix = 2;
    const taken = new Set(snapshot.items.map((entry) => entry.id));
    while (taken.has(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    const item = emptyItem({ id: candidate, title, area });
    item.path = `${itemsRel}/${candidate}.md`;
    if (Array.isArray(input.match)) item.match = input.match.map(String);
    if (Array.isArray(input.testMatch)) item.testMatch = input.testMatch.map(String);
    if (input.priority && PRIORITIES.includes(input.priority)) item.priority = input.priority;
    if (input.stage && STAGES.includes(input.stage)) item.stage = input.stage;
    if (input.question) {
      item.gates.decision = 'pending';
      item.decision.question = String(input.question);
      if (Array.isArray(input.options)) item.decision.options = input.options.map(String);
      if (input.impact) item.decision.impact = String(input.impact);
    }
    if (input.manual === 'pending') {
      item.gates.manual = 'pending';
      if (Array.isArray(input.steps)) item.manual.steps = input.steps.map(String);
    }
    item.updatedBy = input.by || `${machine}/ai`;
    await writeItem(item);
    return refresh();
  }

  async function initBoard() {
    await ensureDir(itemsRel);
    const configTarget = await ctx.fs.resolve(configRel, { cwd: activeRoot });
    const info = await ctx.fs.stat(configTarget);
    if (!info) {
      const skeleton = {
        maxFiles: 20000,
        exclude: ['dist/**', 'build/**', 'out/**', '*.log'],
        tests: { junit: [], json: [] },
      };
      await ctx.fs
        .writeText(
          configTarget,
          `${JSON.stringify(skeleton, null, 2)}\n`,
          { kind: 'createIfAbsent' },
          undefined,
          boardPolicy(),
        )
        .catch(() => {});
    }
    return refresh();
  }

  function appendNote(item, text) {
    const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const block = `\n- ${stamp} ${String(text).replace(/\s*\n\s*/g, ' ')}`;
    item.notes = `${item.notes || ''}${block}\n`;
  }

  // ---- HTTP ---------------------------------------------------------------

  // `webServer` may not exist yet when this plugin applies (service activation
  // order is not guaranteed), so the routes wait for it instead of being
  // skipped for the whole process lifetime.
  ctx.inject(['webServer'], (scoped) => {
    const webServer = scoped.webServer;
    scoped.effect(
      () =>
        webServer.tapIndex((html) => {
          const tag = `<script>window.__GAMEBOARD_TOKEN__=${JSON.stringify(token)}</script>`;
          if (html.includes('</head>')) return html.replace('</head>', `${tag}</head>`);
          return tag + html;
        }),
      'gameboard: token injection',
    );

    scoped.effect(
      () =>
        webServer.register({
          kind: 'exact',
          path: '/gameboard/snapshot',
          handler: async (req, res) => {
            if (req.method !== 'GET') {
              json(res, 405, { ok: false, error: 'method not allowed' });
              return;
            }
            if (!snapshot.items.length && !scanPromise) await runScan();
            json(res, 200, snapshot);
          },
        }),
      'gameboard: snapshot route',
    );

    scoped.effect(
      () =>
        webServer.register({
          kind: 'exact',
          path: '/gameboard/action',
          handler: async (req, res) => {
            if (req.method !== 'POST') {
              json(res, 405, { ok: false, error: 'method not allowed' });
              return;
            }
            if (readHeader(req, 'x-gameboard-token') !== token) {
              json(res, 403, { ok: false, error: '写入令牌无效，请刷新页面后重试' });
              return;
            }
            try {
              const body = await readBody(req);
              const next = await performAction(body);
              json(res, 200, { ok: true, snapshot: next });
            } catch (error) {
              json(res, 200, { ok: false, error: errorText(error) });
            }
          },
        }),
      'gameboard: action route',
    );

    // Fallback for pages that loaded before the token injection was installed:
    // only a same-origin page can read this response.
    scoped.effect(
      () =>
        webServer.register({
          kind: 'exact',
          path: '/gameboard/token',
          handler: (req, res) => {
            if (req.method !== 'GET') {
              json(res, 405, { ok: false, error: 'method not allowed' });
              return;
            }
            if (!isSameOrigin(req, webServer)) {
              json(res, 403, { ok: false, error: 'forbidden' });
              return;
            }
            json(res, 200, { ok: true, token });
          },
        }),
      'gameboard: token route',
    );
  });

  async function performAction(body) {
    const op = body && body.op;
    switch (op) {
      case 'init':
        return initBoard();
      case 'scan':
        return refresh();
      case 'repos':
        return refresh();
      case 'select-root': {
        const next = await selectRoot(body.root);
        startWatch().catch((error) => console.warn('[gameboard] watch failed:', error));
        return next;
      }
      case 'decide': {
        const id = String(body.id || '');
        const choice = String(body.choice || '').trim();
        if (!choice) throw new Error('缺少选择结果');
        return mutateItem(
          id,
          (item) => {
            item.gates.decision = 'decided';
            item.decision.choice = choice;
            item.decision.at = new Date().toISOString();
            item.decision.by = 'user';
            appendNote(item, body.note ? `拍板：${choice}（${body.note}）` : `拍板：${choice}`);
            return item;
          },
          { by: `${machine}/user` },
        );
      }
      case 'manual-step': {
        const id = String(body.id || '');
        const index = Number(body.index);
        const done = body.done !== false;
        return mutateItem(
          id,
          (item) => {
            const set = new Set((item.manual.done || []).filter((n) => Number.isInteger(n)));
            if (done) set.add(index);
            else set.delete(index);
            item.manual.done = [...set].sort((a, b) => a - b);
            if (item.gates.manual !== 'none') {
              item.gates.manual =
                item.manual.steps.length > 0 && item.manual.done.length >= item.manual.steps.length
                  ? 'done'
                  : 'pending';
            }
            return item;
          },
          { by: `${machine}/user` },
        );
      }
      case 'manual-set': {
        const id = String(body.id || '');
        return mutateItem(
          id,
          (item) => {
            item.gates.manual = body.status === 'done' ? 'done' : 'pending';
            if (item.gates.manual === 'done' && item.manual.steps.length) {
              item.manual.done = item.manual.steps.map((_, index) => index);
            }
            return item;
          },
          { by: `${machine}/user` },
        );
      }
      case 'set': {
        const id = String(body.id || '');
        const field = String(body.field || '');
        const value = body.value;
        return mutateItem(
          id,
          (item) => {
            if (field === 'stage') {
              if (!STAGES.includes(value)) throw new Error(`非法阶段：${value}`);
              item.stage = value;
            } else if (field === 'priority') {
              if (!PRIORITIES.includes(value)) throw new Error(`非法优先级：${value}`);
              item.priority = value;
            } else if (field === 'title') {
              item.title = String(value || item.title);
            } else if (field === 'area') {
              item.area = String(value || item.area);
            } else if (field === 'test') {
              item.gates.test = ['untested', 'failing', 'passing'].includes(value)
                ? value
                : item.gates.test;
            } else {
              throw new Error(`不支持修改字段：${field}`);
            }
            return item;
          },
          { by: `${machine}/user` },
        );
      }
      case 'add':
        return createItem({ ...body, by: `${machine}/user` });
      default:
        throw new Error(`未知操作：${op}`);
    }
  }

  // ---- agent tool ---------------------------------------------------------

  function compact(item) {
    const entry = {
      id: item.id,
      title: item.title,
      area: item.area,
      stage: item.stage,
      priority: item.priority,
      gates: item.gates,
      files: item.derived?.filesMatched ?? 0,
      missing: Boolean(item.derived?.missing),
    };
    if (item.gates.decision === 'pending') {
      entry.decision = item.decision.question || item.title;
    }
    if (item.gates.manual === 'pending') {
      entry.manualSteps = item.manual.steps.filter(
        (_, index) => !(item.manual.done || []).includes(index),
      );
    }
    return entry;
  }

  async function runTool(args) {
    const action = String(args.action || 'summary');
    if (action === 'repos') {
      if (args.root) {
        const next = await selectRoot(args.root);
        startWatch().catch((error) => console.warn('[gameboard] watch failed:', error));
        return {
          activeRoot: next.activeRoot,
          counts: next.counts,
          repos: next.repos,
        };
      }
      return { activeRoot, repos: await describeRepos() };
    }
    if (action === 'scan') {
      const next = await refresh();
      return { counts: next.counts, scannedAt: next.generatedAt };
    }
    if (action === 'timeline') {
      const days = Number(args.days) > 0 ? Math.min(365, Number(args.days)) : 7;
      const requested = Number(args.limit);
      const limit = Number.isFinite(requested) && requested > 0 ? Math.min(200, Math.floor(requested)) : 30;
      const events = timelineEvents(snapshot.items, { days, limit });
      const insights = timelineInsights(snapshot.items);
      return {
        windowDays: days,
        total: events.length,
        events,
        slow: insights.slow.slice(0, 5),
        stalled: insights.stalled.slice(0, 5),
      };
    }
    if (snapshot.items.length === 0 && !snapshot.board.initialized) await runScan();
    if (action === 'summary') {
      return {
        board: snapshot.board,
        counts: snapshot.counts,
        areas: snapshot.areas.slice(0, TOOL_AREA_LIMIT),
        digest: digest(snapshot.items, { limit: 12 }),
        scan: {
          generatedAt: snapshot.generatedAt,
          files: snapshot.scan.files,
          errors: snapshot.scan.errors.slice(0, 5),
        },
      };
    }
    if (action === 'list') {
      let items = snapshot.items.slice();
      if (args.area) items = items.filter((item) => item.area === args.area);
      if (args.stage) items = items.filter((item) => item.stage === args.stage);
      if (args.gate === 'decision') {
        items = items.filter((item) => item.gates.decision === 'pending');
      }
      if (args.gate === 'manual') items = items.filter((item) => item.gates.manual === 'pending');
      if (args.gate === 'test') items = items.filter((item) => item.gates.test !== 'passing');
      const order = { urgent: 0, high: 1, normal: 2, low: 3 };
      items.sort(
        (a, b) => (order[a.priority] ?? 2) - (order[b.priority] ?? 2) || a.id.localeCompare(b.id),
      );
      const limit = Math.min(Math.max(Number(args.limit) || 50, 1), 200);
      return { total: items.length, items: items.slice(0, limit).map(compact) };
    }
    if (action === 'get') {
      const item = snapshot.items.find((entry) => entry.id === args.id);
      if (!item) throw new Error(`未知工作项：${args.id}`);
      return item;
    }
    if (action === 'add') {
      const next = await createItem({
        title: args.title,
        area: args.area,
        id: args.id,
        match: args.match,
        testMatch: args.testMatch,
        priority: args.priority,
        stage: args.stage,
        question: args.question,
        options: args.options,
        impact: args.impact,
        by: `${machine}/ai`,
      });
      const created = next.items.find((item) => item.title === args.title);
      return { created: created ? compact(created) : null, counts: next.counts };
    }
    if (action === 'update') {
      const next = await mutateItem(
        String(args.id || ''),
        (item) => {
          if (args.stage) {
            if (!STAGES.includes(args.stage)) throw new Error(`非法阶段：${args.stage}`);
            item.stage = args.stage;
          }
          if (args.priority) {
            if (!PRIORITIES.includes(args.priority)) {
              throw new Error(`非法优先级：${args.priority}`);
            }
            item.priority = args.priority;
          }
          if (args.title) item.title = String(args.title);
          if (args.area) item.area = String(args.area);
          if (Array.isArray(args.match)) item.match = args.match.map(String);
          if (Array.isArray(args.testMatch)) item.testMatch = args.testMatch.map(String);
          if (args.question) {
            item.gates.decision = 'pending';
            item.decision.question = String(args.question);
            if (Array.isArray(args.options)) item.decision.options = args.options.map(String);
            if (args.impact) item.decision.impact = String(args.impact);
          }
          if (args.text) appendNote(item, args.text);
          return item;
        },
        { by: `${machine}/ai` },
      );
      const updated = next.items.find((item) => item.id === args.id);
      return { updated: updated ? compact(updated) : null, counts: next.counts };
    }
    if (action === 'note') {
      const next = await mutateItem(
        String(args.id || ''),
        (item) => {
          if (!args.text) throw new Error('note 需要 text');
          appendNote(item, args.text);
          return item;
        },
        { by: `${machine}/ai` },
      );
      const updated = next.items.find((item) => item.id === args.id);
      return { updated: updated ? compact(updated) : null };
    }
    throw new Error(`未知动作：${action}`);
  }

  ctx.effect(
    () =>
      ctx.tools.register({
        name: 'gameboard',
        description:
          '游戏项目状态板。读取/维护「开发完成、测试通过、需要用户拍板、需要用户手动做」四类状态。' +
          '记录拍板结果只能由用户在面板完成，本工具不能代替用户做决定。',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['summary', 'list', 'get', 'add', 'update', 'note', 'scan', 'repos', 'timeline'],
              description:
                'summary=总览与摘要；list=按条件列工作项；get=单个工作项详情；add=新增工作项；update=改阶段/优先级/测试/待拍板问题；note=追加备注；scan=立即重新扫描仓库；repos=列出/切换仓库；timeline=最近一段时间的里程碑事件、偏离项与停滞项。',
            },
            root: { type: 'string', description: 'repos 动作要切换到的仓库绝对路径' },
            days: { type: 'integer', description: 'timeline 的时间窗（天），默认 7' },
            id: { type: 'string', description: '工作项 id（get/update/note 必填）' },
            area: { type: 'string', description: '模块/领域名称' },
            gate: {
              type: 'string',
              enum: ['decision', 'manual', 'test', 'any'],
              description: 'list 时按门筛选',
            },
            stage: { type: 'string', enum: STAGES },
            title: { type: 'string' },
            priority: { type: 'string', enum: PRIORITIES },
            match: {
              type: 'array',
              items: { type: 'string' },
              description: '关联文件 glob（相对仓库根），如 ["src/combat/**"]',
            },
            testMatch: {
              type: 'array',
              items: { type: 'string' },
              description: '测试用例名/文件关键字，用于从测试报告推导状态',
            },
            question: { type: 'string', description: 'update/add 时设置待拍板问题' },
            options: {
              type: 'array',
              items: { type: 'string' },
              description: '待拍板选项',
            },
            impact: { type: 'string', description: '不拍板的影响' },
            text: { type: 'string', description: 'note 的正文或 update 的备注' },
            limit: { type: 'integer', description: 'list 返回上限，默认 50' },
          },
          required: ['action'],
          additionalProperties: false,
        },
        output: {
          schema: { type: 'object' },
          render(args, value) {
            const text =
              typeof value === 'string' ? value : JSON.stringify(value, null, 2) || 'null';
            return [{ type: 'text', text }];
          },
        },
        async execute(args) {
          return runTool(args || {});
        },
        timeoutMs: 30000,
      }),
    'gameboard: tool',
  );

  // ---- prompt digest and command -----------------------------------------

  if (settings.promptDigest) {
    ctx.inject(['systemPrompt'], (scoped) => {
      scoped.effect(
        () =>
          scoped.systemPrompt.section({
            name: 'gameboard.digest',
            order: 850,
            text: () => {
              const counts = snapshot.counts || {};
              if (!counts.total) return '';
              const parts = [
                `项目看板（${counts.total} 项）：已完成开发 ${counts.built}，测试通过 ${counts.tested}`,
              ];
              if (counts.decisionPending) parts.push(`待用户拍板 ${counts.decisionPending}`);
              if (counts.manualPending) parts.push(`待用户手动 ${counts.manualPending}`);
              if (counts.testFailing) parts.push(`测试失败 ${counts.testFailing}`);
              const head = `${parts.join('，')}。`;
              const detail = digest(snapshot.items, { limit: 6 });
              return `${head}\n${detail}\n状态详情用 gameboard 工具；维护规则见扫描仓库根目录的 AGENTS.md；拍板结果只能由用户在面板记录。`;
            },
          }),
        'gameboard: prompt section',
      );
    });
  }

  ctx.inject(['commands'], (scoped) => {
    scoped.effect(
      () =>
        scoped.commands.register({
          name: 'board',
          description: '打印项目看板摘要',
          handler: async () => ({
            kind: 'success',
            text:
              digest(snapshot.items, { limit: 30 }) ||
              '看板为空：先用 gameboard 工具 add 添加工作项。',
          }),
        }),
      'gameboard: command',
    );
  });

  // ---- scheduling ---------------------------------------------------------

  ctx.effect(() => {
    const disposeInterval = ctx.timer.interval(
      () => scheduleScan(0),
      Math.max(10, Number(settings.scanIntervalSec) || 60) * 1000,
    );
    return () => disposeInterval();
  }, 'gameboard: scan interval');

  let watchController = null;
  let closeWatch = null;

  async function stopWatch() {
    if (watchController) watchController.abort();
    watchController = null;
    if (closeWatch) {
      const close = closeWatch;
      closeWatch = null;
      await close().catch(() => {});
    }
  }

  /** Re-bind the directory watcher; switching repositories moves the target. */
  async function startWatch() {
    await stopWatch();
    if (!settings.watch) return;
    const controller = new AbortController();
    try {
      const target = await ctx.fs.resolve(boardDir());
      const watcher = await ctx.fs.watch(target, () => scheduleScan(400), controller.signal);
      if (controller.signal.aborted) {
        await watcher();
        return;
      }
      watchController = controller;
      closeWatch = watcher;
    } catch (error) {
      console.warn('[gameboard] watch unavailable:', error);
    }
  }

  ctx.effect(() => {
    startWatch().catch((error) => console.warn('[gameboard] watch failed:', error));
    return () => {
      stopWatch().catch(() => {});
      if (watchTimer !== null) {
        clearTimeout(watchTimer);
        watchTimer = null;
      }
    };
  }, 'gameboard: watch board dir');

  ctx.effect(() => {
    scheduleScan(50);
    return () => {
      disposed = true;
      if (watchTimer !== null) clearTimeout(watchTimer);
      watchTimer = null;
    };
  }, 'gameboard: initial scan');

  return {
    snapshot: () => snapshot,
    rescan: refresh,
    lastError: () => lastError,
  };
}
