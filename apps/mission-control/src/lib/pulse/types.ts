export interface GitBranchInfo {
  name: string;
  lastCommitDate: string;
  lastCommitMessage: string;
  staleDays: number;
  commitsAheadOfMain: number;
}

export interface GitWorkingTreeStatus {
  modifiedFiles: string[];
  untrackedFiles: string[];
  stagedFiles: string[];
  totalDirty: number;
}

export interface TodoComment {
  file: string;
  line: number;
  type: 'TODO' | 'FIXME' | 'HACK' | 'TEMP';
  text: string;
  app: string;
}

export interface ChangelogIssue {
  file: string;
  issue: string;
}

export interface ADRProposed {
  file: string;
  title: string;
}

export interface TaskBoardItem {
  section: 'Active' | 'Next';
  id: string;
  title: string;
  checked: boolean;
}

export interface UnfinishedWorkData {
  git: {
    workingTree: GitWorkingTreeStatus;
    branches: GitBranchInfo[];
  };
  code: {
    todos: TodoComment[];
    todosByApp: Record<string, number>;
    changelogIssues: ChangelogIssue[];
    proposedADRs: ADRProposed[];
  };
  taskBoard: {
    activeUnchecked: TaskBoardItem[];
    nextUnchecked: TaskBoardItem[];
  };
  scannedAt: string;
}

export interface GitCommit {
  hash: string;
  date: string;
  message: string;
  author: string;
}

export interface AppActivity {
  app: string;
  lastTouchedDate: string | null;
  dormantDays: number;
  commitsByDay: Record<string, GitCommit[]>;
  totalCommits: number;
}

export interface RecentActivityData {
  apps: AppActivity[];
  totalCommits: number;
  periodDays: number;
  scannedAt: string;
}

export type ChecklistStatus = 'pending' | 'done' | 'blocked';

export interface ChecklistItem {
  id: string;
  app: string;
  description: string;
  status: ChecklistStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface NextStepSuggestion {
  priority: number;
  app: string;
  reason: string;
  detail: string;
  dormantDays: number;
}
