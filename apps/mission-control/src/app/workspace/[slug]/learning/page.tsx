'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft, GraduationCap, Sparkles } from 'lucide-react';
import { Header } from '@/components/Header';
import type { Workspace } from '@/lib/types';

interface LearningQuestion {
  id: string;
  workspace_id: string;
  source_type: 'git_diff' | 'decision_log' | 'manual';
  source_ref?: string | null;
  question: string;
  expected_answer_json: string;
  concept_tag?: string | null;
  created_at: string;
}

interface LearningHistoryRow {
  question_id: string;
  question: string;
  concept_tag?: string | null;
  question_created_at: string;
  answer_id?: string | null;
  score?: number | null;
  grade?: 'good' | 'partial' | 'wrong' | null;
  feedback?: string | null;
  answer_created_at?: string | null;
}

interface AnswerResult {
  id: string;
  question_id: string;
  score: number;
  grade: 'good' | 'partial' | 'wrong';
  feedback: string;
  next_resource: string;
}

function gradeClasses(grade?: string | null): string {
  if (grade === 'good') return 'bg-green-500/15 text-green-300 border-green-500/40';
  if (grade === 'partial') return 'bg-yellow-500/15 text-yellow-300 border-yellow-500/40';
  if (grade === 'wrong') return 'bg-red-500/15 text-red-300 border-red-500/40';
  return 'bg-mc-bg-tertiary text-mc-text-secondary border-mc-border';
}

export default function WorkspaceLearningPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [question, setQuestion] = useState<LearningQuestion | null>(null);
  const [history, setHistory] = useState<LearningHistoryRow[]>([]);
  const [answer, setAnswer] = useState('');
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadLearning(workspaceId: string) {
    const [latestRes, historyRes] = await Promise.all([
      fetch(`/api/learning/questions/latest?workspace_id=${workspaceId}`),
      fetch(`/api/learning/history?workspace_id=${workspaceId}`),
    ]);

    if (latestRes.ok) {
      const payload = (await latestRes.json()) as { question: LearningQuestion | null };
      setQuestion(payload.question || null);
    }

    if (historyRes.ok) {
      const payload = (await historyRes.json()) as { history: LearningHistoryRow[] };
      setHistory(Array.isArray(payload.history) ? payload.history : []);
    }
  }

  useEffect(() => {
    async function loadWorkspace() {
      setIsLoading(true);
      setNotFound(false);
      try {
        const res = await fetch(`/api/workspaces/${slug}`);
        if (!res.ok) {
          setNotFound(res.status === 404);
          return;
        }
        const data = (await res.json()) as Workspace;
        setWorkspace(data);
        await loadLearning(data.id);
      } catch {
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    }

    void loadWorkspace();
  }, [slug]);

  async function generateQuestion() {
    if (!workspace) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/learning/questions/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspace.id,
          source_type: 'decision_log',
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: 'Failed to generate question' }));
        throw new Error(payload.error || 'Failed to generate question');
      }
      const payload = (await res.json()) as {
        question_record?: LearningQuestion;
        question?: LearningQuestion;
      } & Partial<LearningQuestion>;
      const created = payload.question_record || payload.question || (payload as LearningQuestion);
      setQuestion(created);
      setAnswer('');
      setAnswerResult(null);
      await loadLearning(workspace.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate question');
    } finally {
      setBusy(false);
    }
  }

  async function submitAnswer() {
    if (!workspace || !question) return;
    if (answer.trim().length < 8) {
      setError('Answer must be at least 8 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/learning/questions/${question.id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspace.id,
          operator_id: 'operator',
          answer_text: answer,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: 'Failed to score answer' }));
        throw new Error(payload.error || 'Failed to score answer');
      }
      const payload = (await res.json()) as {
        result_record?: AnswerResult;
        result?: AnswerResult;
      } & Partial<AnswerResult>;
      const scored = payload.result_record || payload.result || (payload as AnswerResult);
      setAnswerResult(scored);
      await loadLearning(workspace.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to score answer');
    } finally {
      setBusy(false);
    }
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-mc-bg flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Workspace Not Found</h1>
          <p className="text-mc-text-secondary mb-6">
            The workspace &ldquo;{slug}&rdquo; doesn&apos;t exist.
          </p>
          <Link href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-mc-accent text-mc-bg rounded-lg font-medium">
            <ChevronLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading || !workspace) {
    return (
      <div className="min-h-screen bg-mc-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🦞</div>
          <p className="text-mc-text-secondary">Loading Learning Loop...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-mc-bg overflow-hidden">
      <Header workspace={workspace} />
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="rounded border border-mc-border bg-mc-bg-secondary p-4 flex items-center justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-sm text-mc-accent-cyan uppercase tracking-wide">
                <GraduationCap className="w-4 h-4" />
                Learning Loop
              </div>
              <h1 className="text-xl font-semibold mt-1">Architecture Reasoning Trainer</h1>
              <p className="text-sm text-mc-text-secondary mt-1">
                Generate one question from recent orchestration decisions, answer it, then score your reasoning.
              </p>
            </div>
            <button
              onClick={() => void generateQuestion()}
              disabled={busy}
              className="inline-flex items-center gap-2 px-3 py-2 rounded bg-mc-accent text-mc-bg text-sm font-medium hover:bg-mc-accent/90 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {busy ? 'Generating...' : 'Generate Question'}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <section className="lg:col-span-2 rounded border border-mc-border bg-mc-bg-secondary p-4 space-y-3">
              <div className="text-xs uppercase text-mc-text-secondary">Current Question</div>
              {question ? (
                <>
                  <div className="text-base">{question.question}</div>
                  <div className="text-xs text-mc-text-secondary">
                    Source: {question.source_type} {question.concept_tag ? `• Concept: ${question.concept_tag}` : ''}
                  </div>
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    rows={8}
                    className="w-full bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent resize-y"
                    placeholder="Explain the architecture tradeoff and what could fail if this decision changes..."
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={() => void submitAnswer()}
                      disabled={busy}
                      className="px-3 py-2 rounded bg-mc-accent-cyan text-mc-bg text-sm font-medium hover:bg-mc-accent-cyan/90 disabled:opacity-50"
                    >
                      {busy ? 'Scoring...' : 'Score Answer'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-sm text-mc-text-secondary">No question yet. Generate one to start.</div>
              )}

              {answerResult && (
                <div className="rounded border border-mc-border p-3 bg-mc-bg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded border uppercase ${gradeClasses(answerResult.grade)}`}>
                      {answerResult.grade}
                    </span>
                    <span className="text-sm text-mc-text-secondary">Score {answerResult.score}</span>
                  </div>
                  <div className="text-sm">{answerResult.feedback}</div>
                  <div className="text-xs text-mc-text-secondary mt-2">{answerResult.next_resource}</div>
                </div>
              )}

              {error ? <div className="text-xs text-mc-accent-red">{error}</div> : null}
            </section>

            <aside className="rounded border border-mc-border bg-mc-bg-secondary p-4">
              <div className="text-xs uppercase text-mc-text-secondary mb-3">Recent Scores</div>
              {history.length === 0 ? (
                <div className="text-sm text-mc-text-secondary">No learning history yet.</div>
              ) : (
                <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
                  {history.map((row) => (
                    <div key={row.question_id} className="rounded border border-mc-border/70 p-2">
                      <div className="text-xs line-clamp-2">{row.question}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase ${gradeClasses(row.grade)}`}>
                          {row.grade || 'pending'}
                        </span>
                        {typeof row.score === 'number' && (
                          <span className="text-[10px] text-mc-text-secondary">score {row.score}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
