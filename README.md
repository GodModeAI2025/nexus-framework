# Nexus Framework

**Multi-Agent Multi-User Orchestration for Git-based Projects**

Nexus is a lightweight CLI framework that enables multiple AI agents and human developers to work simultaneously on the same codebase without conflicts. It combines the best architectural patterns from DIA (Digital Innovation Agents) and GSD (Get Shit Done) into a unified system with central project memory, single-writer ownership, and intelligent merge orchestration.

---

## The Problem

When multiple agents (Claude, Codex, Gemini, etc.) and humans work on the same repository, things break:

- Agents overwrite each other's changes
- No one knows what others are currently working on
- Merge conflicts pile up because there's no coordination
- Architectural decisions get lost between sessions
- There's no single source of truth for project state

## The Solution

Nexus adds a `.nexus/` directory to your project containing a SQLite database that serves as the **Central Project Memory**. Git hooks automatically feed it, and agents query it before starting work.

---

## Installation

```bash
# Clone and build
git clone https://github.com/your-org/nexus-framework.git
cd nexus-framework
pnpm install
pnpm build

# Link globally
npm link

# Or use directly
node /path/to/nexus-framework/bin/nexus.js
```

## Quick Start

```bash
# Initialize Nexus in your project
cd your-project
nexus init --install-hooks

# That's it. Nexus is now tracking all activity automatically.
```

---

## Core Concepts

### 1. Flight Recorder (Flugrekorder)

Every commit, branch switch, and significant action is automatically recorded. This gives all agents awareness of what's happening in the project.

```bash
# View active parallel work
nexus active-work

# View full flight log
nexus flight-log --limit 50

# Manual recording (for agent integrations)
nexus flight-record --actor "Claude" --action "plan" --branch "feat/auth" --summary "Planning auth module"
```

### 2. Pre-Flight Check

Before any agent starts planning, it runs a pre-flight check to detect conflicts with ongoing work.

```bash
nexus preflight --actor "Claude" --branch "feat/payments"
```

Output:
```
✅ PRE-FLIGHT CHECK PASSED — No conflicts detected.
   Active parallel work: 2 other branch(es)
   Relevant ADRs: 3

📚 Relevant ADRs:
  ADR-001: Use Stripe for payments
  ADR-003: All API routes must be authenticated
```

Or when conflicts exist:
```
🚫 PRE-FLIGHT CHECK BLOCKED — Critical conflicts detected.
   Active parallel work: 2 other branch(es)
   Conflicts:
     [CRITICAL] ownership: BLOCKED: Unit "src/payments" is claimed by Codex. Wait for release.
```

### 3. Unit Ownership (Single-Writer Engine)

Only one agent can modify a code unit at a time. First-writer-wins semantics prevent race conditions.

```bash
# Claim a unit before working on it
nexus ownership claim --unit "src/auth" --actor "Claude"

# Release when done
nexus ownership release --unit "src/auth" --actor "Claude"

# See who owns what
nexus ownership list
```

### 4. Smart Merge Orchestrator

Analyzes all active branches, detects file overlaps, and recommends the optimal merge order.

```bash
nexus merge-order
```

Output:
```
⚠️  2 potential conflict(s) detected.
Recommended merge order (highest priority first):
  1. feat/schema-migration (architectural changes)
  2. feat/auth
  3. feat/ui-redesign

  Conflict: feat/schema-migration ↔ feat/auth
    Files: src/db/schema.ts, src/db/migrations/001.sql
    Resolution: Merge "feat/schema-migration" FIRST, then rebase "feat/auth".
```

### 5. Architecture Decision Records (ADRs)

Permanent project knowledge that persists across all sessions and agents.

```bash
# Create an ADR
nexus adr create --id ADR-002 --title "Use JWT for auth" \
  --decision "Stateless JWT with 15min expiry" \
  --actor "Tech Lead"

# Accept it
nexus adr accept --id ADR-002

# All agents see it during pre-flight
nexus adr list
```

### 6. Backlog Management

Central backlog with claim semantics — agents pick items and mark them in progress.

```bash
nexus backlog add --id FEAT-05 --title "Add OAuth2 support" --type FEAT --priority P0
nexus backlog claim --id FEAT-05 --actor "Claude"
nexus backlog status --id FEAT-05 --status IN_REVIEW
nexus backlog list
```

---

## Agent Integration

### Environment Variables

Set these in your agent's environment:

```bash
export NEXUS_ACTOR_NAME="Claude"      # Agent identity
export NEXUS_SESSION_ID="session-123"  # Session tracking
```

### Workflow for Agents

Every agent should follow this workflow:

```
1. nexus preflight --actor $NEXUS_ACTOR_NAME --branch $TARGET_BRANCH
2. nexus ownership claim --unit $TARGET_UNIT --actor $NEXUS_ACTOR_NAME
3. [do the work]
4. nexus ownership release --unit $TARGET_UNIT --actor $NEXUS_ACTOR_NAME
5. nexus backlog status --id $ITEM_ID --status IN_REVIEW
```

### Git Hooks (Automatic)

After `nexus init --install-hooks`, these hooks run automatically:

| Hook | Action |
|------|--------|
| `post-commit` | Records commit in flight recorder |
| `post-checkout` | Records branch switches |
| `post-merge` | Triggers cleanup of merged branch data |
| `pre-push` | Runs informational pre-flight check |

---

## Project Status

```bash
nexus status
```

```
╔══════════════════════════════════════════════════════════════╗
║              NEXUS PROJECT STATUS                           ║
╚══════════════════════════════════════════════════════════════╝

  🔄 Active Work:     3 branch(es)
  🔒 Unit Claims:     2 active
  📚 Accepted ADRs:   5
  📋 In Progress:     3 item(s)

  Active Branches:
    • feat/auth (Claude)
    • feat/ui (Codex)
    • fix/perf (Human-Dev)
```

---

## Architecture

```
your-project/
├── .nexus/
│   └── nexus.db          ← SQLite (WAL mode) — Central Project Memory
├── .git/
│   └── hooks/
│       ├── post-commit   ← Auto-records commits
│       ├── post-checkout ← Auto-records branch switches
│       ├── post-merge    ← Auto-cleans merged branch data
│       └── pre-push      ← Informational pre-flight
└── [your source code]
```

### Database Tables

| Table | Purpose |
|-------|---------|
| `adrs` | Permanent architectural decisions |
| `flight_recorder` | Temporary activity log (cleaned after merge) |
| `backlog` | Project backlog with claim semantics |
| `unit_claims` | Single-writer ownership locks |
| `audit_log` | Complete audit trail |

---

## License

MIT
