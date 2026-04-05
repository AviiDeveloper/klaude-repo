'use client';

import { useState } from 'react';
import { GitBranch, FileCode, CheckSquare, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { usePulseStore } from '@/lib/pulse-store';

function Section({
  title,
  icon: Icon,
  count,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon: typeof GitBranch;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded border border-mc-border bg-mc-bg-secondary">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-mc-bg-tertiary transition-colors"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5 text-mc-text-secondary" /> : <ChevronRight className="w-3.5 h-3.5 text-mc-text-secondary" />}
        <Icon className="w-4 h-4 text-mc-text-secondary" />
        <span className="font-medium text-mc-text">{title}</span>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${count > 0 ? 'bg-mc-accent-yellow/15 text-mc-accent-yellow' : 'bg-mc-bg-tertiary text-mc-text-secondary'}`}>
          {count}
        </span>
      </button>
      {open && <div className="px-4 pb-3 border-t border-mc-border">{children}</div>}
    </div>
  );
}

export function UnfinishedWork() {
  const { unfinished } = usePulseStore();
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set());

  if (!unfinished) return null;

  const { git, code, taskBoard } = unfinished;
  const gitCount = git.workingTree.totalDirty + git.branches.length;
  const codeCount = code.todos.length + code.changelogIssues.length + code.proposedADRs.length;
  const taskCount = taskBoard.activeUnchecked.length + taskBoard.nextUnchecked.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-mc-text-secondary mb-1">
        <AlertTriangle className="w-3.5 h-3.5" />
        Unfinished Work
      </div>

      {/* Git Signals */}
      <Section title="Git" icon={GitBranch} count={gitCount} defaultOpen={gitCount > 0}>
        <div className="space-y-3 pt-3">
          {git.workingTree.totalDirty > 0 && (
            <div>
              <div className="text-xs font-medium text-mc-accent-red mb-1">Dirty Working Tree ({git.workingTree.totalDirty} files)</div>
              <div className="space-y-0.5 max-h-32 overflow-y-auto">
                {git.workingTree.modifiedFiles.map((f) => (
                  <div key={f} className="text-[11px] text-mc-text-secondary font-mono">M {f}</div>
                ))}
                {git.workingTree.untrackedFiles.map((f) => (
                  <div key={f} className="text-[11px] text-mc-accent-green font-mono">? {f}</div>
                ))}
                {git.workingTree.stagedFiles.map((f) => (
                  <div key={f} className="text-[11px] text-mc-accent-cyan font-mono">A {f}</div>
                ))}
              </div>
            </div>
          )}

          {git.branches.length > 0 && (
            <div>
              <div className="text-xs font-medium text-mc-text mb-1">Unmerged Branches ({git.branches.length})</div>
              <div className="space-y-1">
                {git.branches.map((b) => (
                  <div key={b.name} className="flex items-center gap-2 text-[11px]">
                    <GitBranch className="w-3 h-3 text-mc-text-secondary flex-shrink-0" />
                    <span className="font-mono text-mc-accent truncate">{b.name}</span>
                    <span className={`text-[10px] ${b.staleDays > 3 ? 'text-mc-accent-red' : 'text-mc-text-secondary'}`}>
                      {b.staleDays}d ago
                    </span>
                    <span className="text-[10px] text-mc-text-secondary">+{b.commitsAheadOfMain}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {gitCount === 0 && <div className="text-xs text-mc-text-secondary italic pt-1">Working tree clean, no stale branches.</div>}
        </div>
      </Section>

      {/* Code Signals */}
      <Section title="Code" icon={FileCode} count={codeCount} defaultOpen={codeCount > 0}>
        <div className="space-y-3 pt-3">
          {Object.entries(code.todosByApp).length > 0 && (
            <div>
              <div className="text-xs font-medium text-mc-text mb-1">TODOs by App</div>
              {Object.entries(code.todosByApp).map(([app, count]) => (
                <div key={app}>
                  <button
                    onClick={() => {
                      const next = new Set(expandedApps);
                      if (next.has(app)) next.delete(app); else next.add(app);
                      setExpandedApps(next);
                    }}
                    className="flex items-center gap-2 text-[11px] w-full py-0.5 hover:text-mc-text text-mc-text-secondary"
                  >
                    {expandedApps.has(app) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    <span className="font-medium">{app}</span>
                    <span className="text-mc-accent-yellow">{count}</span>
                  </button>
                  {expandedApps.has(app) && (
                    <div className="ml-5 space-y-0.5 max-h-40 overflow-y-auto">
                      {code.todos
                        .filter((t) => t.app === app)
                        .map((t, i) => (
                          <div key={i} className="text-[10px] text-mc-text-secondary font-mono">
                            <span className="text-mc-accent-yellow">{t.type}</span> {t.file}:{t.line} — {t.text}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {code.changelogIssues.length > 0 && (
            <div>
              <div className="text-xs font-medium text-mc-text mb-1">Changelog Known Issues ({code.changelogIssues.length})</div>
              <div className="space-y-0.5 max-h-32 overflow-y-auto">
                {code.changelogIssues.map((issue, i) => (
                  <div key={i} className="text-[10px] text-mc-text-secondary">
                    <span className="text-mc-accent-yellow">!</span> {issue.issue}
                  </div>
                ))}
              </div>
            </div>
          )}

          {code.proposedADRs.length > 0 && (
            <div>
              <div className="text-xs font-medium text-mc-text mb-1">Proposed ADRs ({code.proposedADRs.length})</div>
              {code.proposedADRs.map((adr) => (
                <div key={adr.file} className="text-[10px] text-mc-accent-purple">{adr.title}</div>
              ))}
            </div>
          )}

          {codeCount === 0 && <div className="text-xs text-mc-text-secondary italic pt-1">No TODOs, known issues, or proposed ADRs.</div>}
        </div>
      </Section>

      {/* Task Board */}
      <Section title="Task Board" icon={CheckSquare} count={taskCount} defaultOpen={taskCount > 0}>
        <div className="space-y-2 pt-3">
          {taskBoard.activeUnchecked.length > 0 && (
            <div>
              <div className="text-xs font-medium text-mc-accent-red mb-1">Active ({taskBoard.activeUnchecked.length})</div>
              {taskBoard.activeUnchecked.map((item, i) => (
                <div key={i} className="text-[11px] text-mc-text-secondary flex items-center gap-2">
                  <CheckSquare className="w-3 h-3 text-mc-text-secondary" />
                  {item.id && <span className="font-mono text-mc-accent-yellow">{item.id}</span>}
                  <span>{item.title}</span>
                </div>
              ))}
            </div>
          )}
          {taskBoard.nextUnchecked.length > 0 && (
            <div>
              <div className="text-xs font-medium text-mc-text mb-1">Next ({taskBoard.nextUnchecked.length})</div>
              {taskBoard.nextUnchecked.map((item, i) => (
                <div key={i} className="text-[11px] text-mc-text-secondary flex items-center gap-2">
                  <CheckSquare className="w-3 h-3 text-mc-text-secondary" />
                  {item.id && <span className="font-mono text-mc-accent">{item.id}</span>}
                  <span>{item.title}</span>
                </div>
              ))}
            </div>
          )}
          {taskCount === 0 && <div className="text-xs text-mc-text-secondary italic pt-1">All task board items are checked off.</div>}
        </div>
      </Section>
    </div>
  );
}
