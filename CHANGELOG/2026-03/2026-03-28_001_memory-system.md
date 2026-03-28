# MSA-Inspired Memory System

## What changed
- Created `src/memory/` module with 8 new files:
  - `types.ts` — MemoryDocument, MemoryQuery, MemoryResult, MemoryTags, ScoredCandidate types
  - `scorer.ts` — MemoryScorer interface, BM25Scorer implementation, tokenizer, TF-IDF routing key extractor
  - `sqliteMemoryStore.ts` — SQLite store with FTS5 full-text search, tiered storage, IDF tracking, retrieval logging, monitor state
  - `memoryIndexer.ts` — Converts traces, decisions, evals, journal entries into memory documents
  - `memoryRouter.ts` — Three-stage query pipeline (tag pre-filter → FTS5 BM25 → content load) with Memory Interleave for multi-hop
  - `memoryCompressor.ts` — Progressive summarization: detailed → compressed → archived tier transitions
  - `msaWeightMonitor.ts` — Daily GitHub + HuggingFace monitor for MSA-4B model weight release with Telegram alerts
  - `index.ts` — Public MemorySystem class wiring all components
- Created `src/tests/memory.test.ts` — 15 tests covering scorer, store, indexer, router, compressor, and interface contract
- Modified `apps/mission-control/src/lib/types.ts` — Added `memory_context` field to MemoryPacket interface
- Modified `apps/mission-control/src/lib/memory/packet.ts` — Extended buildMemoryPacket with `includeMemory` option and FTS5 retrieval; extended formatMemoryPacketForPrompt to render memory context
- Modified `apps/mission-control/src/lib/db/migrations.ts` — Added migration 016 for memory_documents, memory_fts (FTS5), memory_idf, memory_retrievals, and monitor_state tables

## Why
Implementing an MSA (Memory Sparse Attention) paper-inspired memory system to give agents cross-session memory, efficient retrieval of past experiences, and multi-hop reasoning across scattered evidence. Currently no semantic retrieval exists — all memory is direct DB queries.

## Stack
- TypeScript, SQLite (better-sqlite3), FTS5 full-text search, BM25 ranking
- Node.js crypto (randomUUID), node:test framework

## Integrations
- GitHub API (EverMind-AI/MSA repo monitoring)
- HuggingFace API (model search monitoring)
- Telegram Bot API (weight release notifications)
- Mission Control memory packet system (extended)

## How to verify
1. `npx tsx --test src/tests/memory.test.ts` — 15 tests pass (tokenizer, BM25, FTS5, indexer, router, compressor, scorer contract)
2. `npx tsc --noEmit` — orchestration runtime typechecks clean
3. `npm run verify` — 202 pass, 1 pre-existing fail (outreach pipeline)
4. Memory system can be instantiated: `new MemorySystem({ dbPath: 'data/memory.db' })`
5. MSA monitor can be triggered: `system.checkMSAWeights()` checks GitHub + HuggingFace

## Known issues
- MSA-4B model weights not yet released by EverMind — BM25/FTS5 is the active scorer
- MC build has pre-existing dependency issues (lucide-react not installed, Next.js .next/types errors)
- MemoryScorer interface ready for Phase B swap to neural MSA scorer when weights become available
