import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { differenceInDays } from 'date-fns';
import type {
  GitWorkingTreeStatus,
  GitBranchInfo,
  TodoComment,
  ChangelogIssue,
  ADRProposed,
  TaskBoardItem,
  UnfinishedWorkData,
  AppActivity,
  GitCommit,
  RecentActivityData,
} from './types';

const REPO_ROOT = path.resolve(process.cwd(), '../..');

const APP_DIRS: Record<string, string> = {
  'sales-dashboard': 'apps/sales-dashboard',
  'ios': 'apps/ios',
  'mission-control': 'apps/mission-control',
  'admin-panel': 'apps/admin-panel',
  'mobile-api': 'apps/mobile-api',
  'runtime': 'src',
};

const TODO_PATTERN = /\b(TODO|FIXME|HACK|TEMP)\b[:\s]+(.*)/i;
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.swift']);
const SKIP_DIRS = new Set(['node_modules', '.next', 'build', 'dist', '.git', 'SalesFlow.xcodeproj', '.build']);

function git(cmd: string): string {
  try {
    return execSync(`git ${cmd}`, { cwd: REPO_ROOT, encoding: 'utf-8', timeout: 10000 }).trim();
  } catch {
    return '';
  }
}

// ─── Git Signals ───

export function scanGitWorkingTree(): GitWorkingTreeStatus {
  const output = git('status --porcelain');
  const modified: string[] = [];
  const untracked: string[] = [];
  const staged: string[] = [];

  for (const line of output.split('\n').filter(Boolean)) {
    const index = line[0];
    const worktree = line[1];
    const file = line.slice(3);

    if (index === '?' && worktree === '?') {
      untracked.push(file);
    } else {
      if (index !== ' ' && index !== '?') staged.push(file);
      if (worktree === 'M' || worktree === 'D') modified.push(file);
    }
  }

  return { modifiedFiles: modified, untrackedFiles: untracked, stagedFiles: staged, totalDirty: modified.length + untracked.length + staged.length };
}

export function scanGitBranches(): GitBranchInfo[] {
  const raw = git("for-each-ref --sort=-committerdate --format=%(refname:short)|%(committerdate:iso-strict)|%(subject) refs/heads/");
  if (!raw) return [];

  const now = new Date();
  const branches: GitBranchInfo[] = [];

  for (const line of raw.split('\n').filter(Boolean)) {
    const [name, dateStr, ...msgParts] = line.split('|');
    if (name === 'main' || name === 'master') continue;

    const lastCommitDate = dateStr || '';
    const staleDays = lastCommitDate ? differenceInDays(now, new Date(lastCommitDate)) : 999;

    // Only include branches from last 30 days
    if (staleDays > 30) continue;

    let commitsAhead = 0;
    try {
      const count = git(`rev-list --count main..${name}`);
      commitsAhead = parseInt(count, 10) || 0;
    } catch {
      // ignore
    }

    branches.push({
      name,
      lastCommitDate,
      lastCommitMessage: msgParts.join('|'),
      staleDays,
      commitsAheadOfMain: commitsAhead,
    });
  }

  return branches;
}

// ─── Code Signals ───

function walkSourceFiles(dir: string, files: string[] = []): string[] {
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walkSourceFiles(full, files);
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

export function scanTodos(): TodoComment[] {
  const todos: TodoComment[] = [];

  for (const [appName, appDir] of Object.entries(APP_DIRS)) {
    const absDir = path.join(REPO_ROOT, appDir);
    const files = walkSourceFiles(absDir);

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const match = lines[i].match(TODO_PATTERN);
          if (match) {
            todos.push({
              file: path.relative(REPO_ROOT, file),
              line: i + 1,
              type: match[1].toUpperCase() as TodoComment['type'],
              text: match[2].trim(),
              app: appName,
            });
          }
        }
      } catch {
        // skip unreadable files
      }
    }
  }

  return todos;
}

export function scanChangelogIssues(): ChangelogIssue[] {
  const issues: ChangelogIssue[] = [];
  const changelogDir = path.join(REPO_ROOT, 'CHANGELOG');
  if (!fs.existsSync(changelogDir)) return issues;

  const mdFiles = walkMarkdownFiles(changelogDir);

  for (const file of mdFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      let inKnownIssues = false;

      for (const line of lines) {
        if (/^##\s+Known\s+issues/i.test(line)) {
          inKnownIssues = true;
          continue;
        }
        if (inKnownIssues && /^##\s/.test(line)) {
          inKnownIssues = false;
          continue;
        }
        if (inKnownIssues && /^-\s+/.test(line)) {
          issues.push({
            file: path.relative(REPO_ROOT, file),
            issue: line.replace(/^-\s+/, '').trim(),
          });
        }
      }
    } catch {
      // skip
    }
  }

  return issues;
}

function walkMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkMarkdownFiles(full));
    } else if (entry.name.endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
}

export function scanProposedADRs(): ADRProposed[] {
  const adrs: ADRProposed[] = [];
  const adrDir = path.join(REPO_ROOT, 'ADR');
  if (!fs.existsSync(adrDir)) return adrs;

  for (const entry of fs.readdirSync(adrDir)) {
    if (!entry.endsWith('.md')) continue;
    const file = path.join(adrDir, entry);
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      let inStatus = false;

      for (const line of lines) {
        if (/^##\s+Status/i.test(line)) {
          inStatus = true;
          continue;
        }
        if (inStatus) {
          if (/proposed/i.test(line)) {
            // Extract title from first heading
            const titleMatch = content.match(/^#\s+(.+)/m);
            adrs.push({
              file: path.relative(REPO_ROOT, file),
              title: titleMatch ? titleMatch[1].trim() : entry,
            });
          }
          break; // only check first line after ## Status
        }
      }
    } catch {
      // skip
    }
  }

  return adrs;
}

export function parseTaskBoard(): { activeUnchecked: TaskBoardItem[]; nextUnchecked: TaskBoardItem[] } {
  const file = path.join(REPO_ROOT, 'TASK_BOARD.md');
  if (!fs.existsSync(file)) return { activeUnchecked: [], nextUnchecked: [] };

  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');

  let currentSection: 'Active' | 'Next' | 'Done' | null = null;
  const activeUnchecked: TaskBoardItem[] = [];
  const nextUnchecked: TaskBoardItem[] = [];

  for (const line of lines) {
    if (/^##\s+Active/i.test(line)) { currentSection = 'Active'; continue; }
    if (/^##\s+Next/i.test(line)) { currentSection = 'Next'; continue; }
    if (/^##\s+Done/i.test(line)) { currentSection = 'Done'; continue; }

    if (currentSection === 'Done') continue;
    if (!currentSection) continue;

    const unchecked = line.match(/^-\s+\[\s\]\s+(.*)/);
    if (unchecked) {
      const text = unchecked[1].trim();
      const idMatch = text.match(/^(\S+-\d+\S*):\s*(.*)/);
      const item: TaskBoardItem = {
        section: currentSection,
        id: idMatch ? idMatch[1] : '',
        title: idMatch ? idMatch[2].trim() : text,
        checked: false,
      };
      if (currentSection === 'Active') activeUnchecked.push(item);
      else nextUnchecked.push(item);
    }
  }

  return { activeUnchecked, nextUnchecked };
}

// ─── Recent Activity ───

export function scanRecentActivity(days: number = 7): RecentActivityData {
  const now = new Date();
  const apps: AppActivity[] = [];
  let totalCommits = 0;

  for (const [appName, appDir] of Object.entries(APP_DIRS)) {
    const raw = git(`log --all --since="${days} days ago" --format=%H|%aI|%s|%an -- ${appDir}`);
    const commits: GitCommit[] = [];

    if (raw) {
      for (const line of raw.split('\n').filter(Boolean)) {
        const [hash, date, ...rest] = line.split('|');
        const msgAndAuthor = rest.join('|');
        const lastPipe = msgAndAuthor.lastIndexOf('|');
        const message = lastPipe > 0 ? msgAndAuthor.slice(0, lastPipe) : msgAndAuthor;
        const author = lastPipe > 0 ? msgAndAuthor.slice(lastPipe + 1) : '';

        commits.push({ hash, date, message, author });
      }
    }

    const commitsByDay: Record<string, GitCommit[]> = {};
    for (const c of commits) {
      const day = c.date.slice(0, 10);
      if (!commitsByDay[day]) commitsByDay[day] = [];
      commitsByDay[day].push(c);
    }

    const lastTouchedDate = commits.length > 0 ? commits[0].date : null;
    const dormantDays = lastTouchedDate ? differenceInDays(now, new Date(lastTouchedDate)) : 999;

    apps.push({
      app: appName,
      lastTouchedDate,
      dormantDays,
      commitsByDay,
      totalCommits: commits.length,
    });

    totalCommits += commits.length;
  }

  // Sort: most recently active first
  apps.sort((a, b) => a.dormantDays - b.dormantDays);

  return { apps, totalCommits, periodDays: days, scannedAt: now.toISOString() };
}

// ─── Aggregators ───

export function getUnfinishedWork(): UnfinishedWorkData {
  const todos = scanTodos();
  const todosByApp: Record<string, number> = {};
  for (const todo of todos) {
    todosByApp[todo.app] = (todosByApp[todo.app] || 0) + 1;
  }

  return {
    git: {
      workingTree: scanGitWorkingTree(),
      branches: scanGitBranches(),
    },
    code: {
      todos,
      todosByApp,
      changelogIssues: scanChangelogIssues(),
      proposedADRs: scanProposedADRs(),
    },
    taskBoard: parseTaskBoard(),
    scannedAt: new Date().toISOString(),
  };
}

export function getRecentActivity(days: number = 7): RecentActivityData {
  return scanRecentActivity(Math.min(Math.max(days, 1), 30));
}
