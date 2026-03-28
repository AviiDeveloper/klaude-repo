/**
 * Memory Compressor — progressive summarization inspired by MSA's KV cache compression.
 *
 * Tier transitions:
 * - detailed (0-7 days): full_content + compressed_content + routing_keys
 * - compressed (7-30 days): compressed_content + routing_keys (full_content dropped)
 * - archived (30+ days): routing_keys + tags only (still participates in BM25 scoring)
 */

import type { SQLiteMemoryStore } from "./sqliteMemoryStore.js";
import { tokenize } from "./scorer.js";

interface CompressionConfig {
  detailedMaxAgeDays: number;
  compressedMaxAgeDays: number;
}

const DEFAULT_CONFIG: CompressionConfig = {
  detailedMaxAgeDays: 7,
  compressedMaxAgeDays: 30,
};

export class MemoryCompressor {
  constructor(
    private readonly store: SQLiteMemoryStore,
    private readonly config: CompressionConfig = DEFAULT_CONFIG,
  ) {}

  /**
   * Run compression cycle. Transitions documents between tiers based on age.
   * Returns count of documents transitioned.
   */
  runCompression(): { compressed: number; archived: number } {
    let compressed = 0;
    let archived = 0;

    // Detailed → Compressed (drop full_content, keep compressed summary)
    const detailedCutoff = this.daysAgo(this.config.detailedMaxAgeDays);
    const toCompress = this.store.getDocumentsForCompression({
      olderThan: detailedCutoff,
      currentTier: "detailed",
    });

    for (const doc of toCompress) {
      const summary = doc.compressed_content || this.generateSummary(doc.full_content || "");
      this.store.updateTier(doc.id, "compressed", summary);
      compressed++;
    }

    // Compressed → Archived (drop compressed_content, keep routing keys + tags)
    const compressedCutoff = this.daysAgo(this.config.compressedMaxAgeDays);
    const toArchive = this.store.getDocumentsForCompression({
      olderThan: compressedCutoff,
      currentTier: "compressed",
    });

    for (const doc of toArchive) {
      this.store.updateTier(doc.id, "archived");
      archived++;
    }

    return { compressed, archived };
  }

  /**
   * Generate a compressed summary from full text.
   * Keeps: first sentence (context), last sentence (outcome),
   * and sentences containing high-frequency terms.
   */
  private generateSummary(text: string): string {
    const sentences = text
      .split(/[.\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);

    if (sentences.length <= 3) return text;

    const first = sentences[0];
    const last = sentences[sentences.length - 1];

    const terms = tokenize(text);
    const freq = new Map<string, number>();
    for (const t of terms) {
      freq.set(t, (freq.get(t) || 0) + 1);
    }

    const topTerms = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t]) => t);

    const keyMiddle = sentences
      .slice(1, -1)
      .filter((s) => topTerms.some((t) => s.toLowerCase().includes(t)))
      .slice(0, 2);

    return [first, ...keyMiddle, last].join(". ");
  }

  private daysAgo(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  }
}
