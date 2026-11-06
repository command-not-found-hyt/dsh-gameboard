/**
 * Optional git awareness for the timeline.
 *
 * The Host runs one `git log` per scan and attaches, for every work item, the
 * commits that touched its board file plus the commit nearest each milestone.
 * Everything degrades to "no git data" when git is missing or the repository
 * is not a checkout.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const FIELD = '\u001f';
export const DEFAULT_LIMIT = 300;
export const MILESTONE_COMMIT_KEYS = {
  startedAt: 'started',
  builtAt: 'built',
  testedAt: 'tested',
  shippedAt: 'shipped',
  decidedAt: 'decided',
  manualDoneAt: 'manualDone',
};

/**
 * Parse `git log --pretty=format:%H<US>%aI<US>%s --name-only` output.
 * @param {string} text
 * @returns {Array<{hash: string, at: string, subject: string, files: string[]}>}
 */
export function parseGitLog(text) {
  const commits = [];
  if (!text) return commits;
  let current = null;
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.includes(FIELD)) {
      const [hash, at, subject] = line.split(FIELD);
      if (hash && /^[0-9a-f]{7,40}$/i.test(hash.trim())) {
        current = {
          hash: hash.trim(),
          at: (at || '').trim(),
          subject: (subject || '').trim(),
          files: [],
        };
        commits.push(current);
        continue;
      }
    }
    if (current) current.files.push(decodeGitPath(line));
  }
  return commits;
}

/** Undo git's C-style quoting so non-ASCII paths compare against item paths. */
function decodeGitPath(raw) {
  const value = String(raw || '').trim();
  if (!value.startsWith('"') || !value.endsWith('"')) return value.replace(/\\/g, '/');
  const inner = value.slice(1, -1);
  const bytes = [];
  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index];
    if (char !== '\\') {
      bytes.push(...Buffer.from(char, 'utf8'));
      continue;
    }
    const octal = inner.slice(index + 1, index + 4);
    if (/^[0-7]{3}$/.test(octal)) {
      bytes.push(parseInt(octal, 8));
      index += 3;
      continue;
    }
    const next = inner[index + 1] || '';
    const escapes = { n: 10, t: 9, '"': 34, '\\': 92 };
    bytes.push(next in escapes ? escapes[next] : next.charCodeAt(0));
    index += 1;
  }
  return Buffer.from(bytes).toString('utf8').replace(/\\/g, '/');
}

/**
 * Read the repository's recent commit log. Resolves to `null` when git is
 * unavailable, the command fails, or the directory is not a repository.
 */
export async function readGitLog({ root, gitBin = 'git', limit = DEFAULT_LIMIT, timeoutMs = 5000 } = {}) {
  if (!root) return null;
  try {
    const { stdout } = await execFileAsync(
      gitBin,
      [
        '-c',
        // Keep non-ASCII paths verbatim; octal quoting would break matching.
        'core.quotepath=false',
        '-C',
        root,
        'log',
        `--pretty=format:%H${FIELD}%aI${FIELD}%s`,
        '--name-only',
        '-n',
        String(limit),
      ],
      { maxBuffer: 8 * 1024 * 1024, timeout: timeoutMs, windowsHide: true },
    );
    return parseGitLog(stdout);
  } catch {
    return null;
  }
}

/** Nearest commit at or after `timestamp`, else the newest one before it. */
function nearestCommit(commits, timestamp) {
  const target = Date.parse(timestamp);
  if (!Number.isFinite(target)) return null;
  let after = null;
  let before = null;
  for (const commit of commits) {
    const when = Date.parse(commit.at);
    if (!Number.isFinite(when)) continue;
    if (when >= target - 5 * 60 * 1000) {
      if (!after || when < Date.parse(after.at)) after = commit;
    } else if (!before || when > Date.parse(before.at)) {
      before = commit;
    }
  }
  return after || before;
}

/**
 * Attach `item.git` from the parsed log. Mutates and returns the item.
 * @param {object} item normalised work item
 * @param {Array} commits output of {@link parseGitLog}
 */
export function attachGit(item, commits) {
  if (!item || !Array.isArray(commits)) return item;
  const path = String(item.path || '').replace(/\\/g, '/');
  const touching = path ? commits.filter((commit) => commit.files.includes(path)) : [];
  const milestoneCommits = {};
  const milestones = item.milestones && typeof item.milestones === 'object' ? item.milestones : {};
  for (const [field, key] of Object.entries(MILESTONE_COMMIT_KEYS)) {
    const stamp = milestones[field];
    if (!stamp) continue;
    const commit = nearestCommit(touching, stamp);
    if (commit) {
      milestoneCommits[key] = {
        hash: commit.hash.slice(0, 8),
        at: commit.at,
        subject: commit.subject,
      };
    }
  }
  const latest = touching.length > 0 ? touching[0] : null;
  item.git = {
    commits: touching.slice(0, 5).map((commit) => ({
      hash: commit.hash.slice(0, 8),
      at: commit.at,
      subject: commit.subject,
    })),
    milestoneCommits,
    lastCommitAt: latest ? latest.at : '',
    dirty: Boolean(
      latest && item.updatedAt && Date.parse(item.updatedAt) > Date.parse(latest.at) + 1000,
    ),
  };
  return item;
}
