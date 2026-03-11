# Changelog

All notable changes to Mission Control will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- Persistent operator memory APIs:
  - `GET/PUT /api/memory/operator` for workspace-scoped operator profile storage
  - `GET /api/memory/packet` for assembled runtime memory packet inspection
- Agent Context & Identity Standard framework:
  - new professional-standard builder/validator covering mandatory 10 sections
  - Agent Factory now stores structured professional-standard metadata on creation
  - AI profile suggest endpoint expanded with seniority/authority/heartbeat drafting fields
  - Agent Factory wizard expanded to dedicated onboarding pages for every professional-standard field
  - Agent Factory now enforces AI-first onboarding bootstrap (`AI: Fill All 10 Pages`) with explicit manual fallback override
  - AI suggest prompt expanded to draft the full professional profile field set (identity/expertise/context/authority/communication/heartbeat)
- Agent Factory now runs AI interview-first onboarding: targeted question generation -> operator answers -> AI context-sheet synthesis -> profile autofill
- Agent Factory onboarding is now a clear 10-section page flow (instead of 57 single-field steps) aligned to professional-standard sections
- AI autofill now preserves explicit operator-entered values and only fills missing fields by default
- Agent Factory interview UX now asks one adaptive question at a time (context-aware follow-ups) instead of a dense multi-question list
- Interview stage now has reduced screen density by hiding profile-page forms until interview/context bootstrap is complete
- Agent Factory AI build now runs a second AI backfill pass for any remaining required fields before asking for manual input
- Agent Factory now exposes a top-level `Generate Agent Now` action as soon as required fields are satisfied (no need to navigate to the final page first)
- Lead Orchestrator control plane foundation:
  - new SQLite-backed lead intake/delegation/decision/finding/approval/memory-journal tables
  - new Lead APIs: `/api/lead/queue`, `/api/lead/tasks/intake`, `/api/lead/tasks/:id/delegate`, `/api/lead/tasks/:id/decision-log`, `/api/lead/tasks/:id/findings`, `/api/lead/tasks/:id/approval-request`, `/api/lead/tasks/:id/approval-decision`, `/api/lead/memory/packet`, `/api/lead/commands`
  - new Lead memory packet includes operator/business context plus agent performance + open blockers + recent lead decisions
  - new Lead Console panel in workspace live feed and per-task Lead Timeline tab
  - task creation now routes into Lead intake by default (lead-owned triage/delegation path)
  - dispatch endpoint now fail-closes when no valid lead delegation exists for assigned worker

### Changed

- Task dispatch now injects operator/workspace/task/agent memory context into OpenClaw task prompts so agents align to operator preferences and reporting style by default.
- Task dispatch now injects an explicit 10-section professional runtime contract (identity, expertise, operating context, current situation, memory, tools, communication, authority, standards, heartbeat behavior) before execution.

---

## [1.0.1] - 2026-02-04

### Changed

- **Clickable Deliverables** - URL deliverables now have clickable titles and paths that open in new tabs
- Improved visual feedback on deliverable links (hover states, external link icons)

---

## [1.0.0] - 2026-02-04

### 🎉 First Official Release

This is the first stable, tested, and working release of Mission Control.

### Added

- **Task Management**
  - Create, edit, and delete tasks
  - Drag-and-drop Kanban board with 7 status columns
  - Task priority levels (low, normal, high, urgent)
  - Due date support

- **AI Planning Mode**
  - Interactive Q&A planning flow with AI
  - Multiple choice questions with "Other" option for custom answers
  - Automatic spec generation from planning answers
  - Planning session persistence (resume interrupted planning)

- **Agent System**
  - Automatic agent creation based on task requirements
  - Agent avatars with emoji support
  - Agent status tracking (standby, working, idle)
  - Custom SOUL.md personality for each agent

- **Task Dispatch**
  - Automatic dispatch after planning completes
  - Task instructions sent to agent with full context
  - Project directory creation for deliverables
  - Activity logging and deliverable tracking

- **OpenClaw Integration**
  - WebSocket connection to OpenClaw Gateway
  - Session management for planning and agent sessions
  - Chat history synchronization
  - Multi-machine support (local and remote gateways)

- **Dashboard UI**
  - Clean, dark-themed interface
  - Real-time task updates
  - Event feed showing system activity
  - Agent status panel
  - Responsive design

- **API Endpoints**
  - Full REST API for tasks, agents, and events
  - File upload endpoint for deliverables
  - OpenClaw proxy endpoints for session management
  - Activity and deliverable tracking endpoints

### Technical Details

- Built with Next.js 15 (App Router)
- SQLite database with automatic migrations
- Tailwind CSS for styling
- TypeScript throughout
- WebSocket client for OpenClaw communication

---

## [0.1.0] - 2026-02-03

### Added

- Initial project setup
- Basic task CRUD
- Kanban board prototype
- OpenClaw connection proof of concept

---

## Future Plans

- [ ] Multiple workspaces
- [ ] Team collaboration
- [ ] Task dependencies
- [ ] Agent performance metrics
- [ ] Webhook integrations
- [ ] Mobile-responsive improvements
- [ ] Dark/light theme toggle

---

[1.0.1]: https://github.com/crshdn/mission-control/releases/tag/v1.0.1
[1.0.0]: https://github.com/crshdn/mission-control/releases/tag/v1.0.0
[0.1.0]: https://github.com/crshdn/mission-control/releases/tag/v0.1.0
