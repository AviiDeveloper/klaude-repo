/**
 * Memory system types — MSA-inspired memory for multi-agent orchestration.
 *
 * Core concepts from the MSA paper adapted to application level:
 * - MemoryDocument: independent memory unit with routing keys (like MSA's document-wise isolation)
 * - MemoryTags: structured coarse-grained routing (like MSA's pre-filter before sparse attention)
 * - MemoryQuery: query specification with tag filters and scorer selection
 * - MemoryResult: scored result from the three-stage query pipeline
 */

export type MemorySourceType =
  | "trace"
  | "decision"
  | "transcript"
  | "eval"
  | "journal"
  | "operator_preference";

export type MemoryTier = "detailed" | "compressed" | "archived";

export type MemoryOutcome = "success" | "partial" | "fail" | "unknown";

export interface MemoryTags {
  agent_id?: string;
  task_type?: string;
  outcome?: MemoryOutcome;
  domain?: string;
  concepts: string[];
}

export interface MemoryDocument {
  id: string;
  workspace_id: string;
  agent_id?: string;
  source_type: MemorySourceType;
  source_id?: string;
  routing_keys: string[];
  tags: MemoryTags;
  tier: MemoryTier;
  compressed_content: string;
  full_content?: string;
  access_count: number;
  last_accessed_at?: string;
  relevance_decay: number;
  created_at: string;
  updated_at: string;
}

export interface MemoryQuery {
  query_text: string;
  workspace_id: string;
  agent_id?: string;
  tag_filters?: Partial<MemoryTags>;
  tier_filter?: MemoryTier[];
  top_k?: number;
  max_candidates?: number;
  enable_interleave?: boolean;
  max_hops?: number;
}

export interface MemoryResult {
  document: MemoryDocument;
  score: number;
  hop_number: number;
}

export interface MemoryRetrievalLog {
  id: string;
  query_text: string;
  query_tags?: Partial<MemoryTags>;
  workspace_id: string;
  agent_id?: string;
  retrieved_doc_ids: string[];
  scores: number[];
  hop_number: number;
  latency_ms: number;
  created_at: string;
}

export interface ScoredCandidate {
  doc_id: string;
  routing_keys: string[];
  relevance_decay: number;
  score: number;
}
