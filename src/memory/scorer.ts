/**
 * MemoryScorer interface — swappable scoring backend.
 *
 * Phase A: BM25Scorer (pure TypeScript, runs on Pi 400)
 * Phase B: MSAScorer (HTTP client to MSA-4B inference server on GPU VPS)
 *
 * Inspired by MSA's three-stage inference: the scorer handles Stage 2 (routing/scoring)
 * while Stage 1 (routing key extraction) happens at index time and Stage 3 (content load)
 * happens in the router after scoring.
 */

import type { ScoredCandidate } from "./types.js";

export interface MemoryScorer {
  /**
   * Score a list of candidate documents against a query.
   * Returns candidates with scores, sorted descending by score.
   */
  score(
    queryTerms: string[],
    candidates: Array<{
      doc_id: string;
      routing_keys: string[];
      relevance_decay: number;
    }>,
  ): ScoredCandidate[];
}

// ─── BM25 constants ───
const K1 = 1.2;
const B = 0.75;

export class BM25Scorer implements MemoryScorer {
  constructor(
    private readonly idfLookup: (term: string) => number,
    private readonly totalDocs: () => number,
    private readonly avgDocLength: () => number,
  ) {}

  score(
    queryTerms: string[],
    candidates: Array<{
      doc_id: string;
      routing_keys: string[];
      relevance_decay: number;
    }>,
  ): ScoredCandidate[] {
    const N = this.totalDocs();
    const avgDl = this.avgDocLength();

    const scored: ScoredCandidate[] = candidates.map((candidate) => {
      const dl = candidate.routing_keys.length;
      let bm25 = 0;

      for (const term of queryTerms) {
        const tf = candidate.routing_keys.filter((k) => k === term).length;
        if (tf === 0) continue;

        const df = this.idfLookup(term);
        const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
        const tfNorm = (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * (dl / avgDl)));
        bm25 += idf * tfNorm;
      }

      return {
        doc_id: candidate.doc_id,
        routing_keys: candidate.routing_keys,
        relevance_decay: candidate.relevance_decay,
        score: bm25 * candidate.relevance_decay,
      };
    });

    return scored.sort((a, b) => b.score - a.score);
  }
}

// ─── Text tokenization ───

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "dare", "ought",
  "to", "of", "in", "for", "on", "with", "at", "by", "from", "as",
  "into", "through", "during", "before", "after", "above", "below",
  "between", "out", "off", "over", "under", "again", "further",
  "then", "once", "and", "but", "or", "nor", "not", "so", "yet",
  "both", "either", "neither", "each", "every", "all", "any", "few",
  "more", "most", "other", "some", "such", "no", "only", "own",
  "same", "than", "too", "very", "just", "because", "if", "when",
  "while", "this", "that", "these", "those", "it", "its", "he", "she",
  "they", "them", "their", "we", "us", "our", "you", "your",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_\-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/**
 * Extract top-N routing keys from text using TF-IDF scoring.
 * IDF values come from the memory store's accumulated corpus statistics.
 */
export function extractRoutingKeys(
  text: string,
  idfLookup: (term: string) => number,
  totalDocs: number,
  maxKeys: number = 20,
): string[] {
  const terms = tokenize(text);
  if (terms.length === 0) return [];

  // Compute term frequency
  const tf = new Map<string, number>();
  for (const term of terms) {
    tf.set(term, (tf.get(term) || 0) + 1);
  }

  // Score each unique term by TF-IDF
  const scored: Array<{ term: string; tfidf: number }> = [];
  for (const [term, count] of tf) {
    const df = idfLookup(term);
    const idf = Math.log((totalDocs + 1) / (df + 1)) + 1;
    const normalizedTf = count / terms.length;
    scored.push({ term, tfidf: normalizedTf * idf });
  }

  scored.sort((a, b) => b.tfidf - a.tfidf);
  return scored.slice(0, maxKeys).map((s) => s.term);
}
