<!--
Nexus Framework - Backlog Template
Based on DIA v3 BACKLOG-TEMPLATE.md

This file is the SINGLE SOURCE OF TRUTH for:
1. Implementation status of every artifact (Feature, ADR, Plan, Fix, Improvement, Epic)
2. The relation graph between artifacts (Refs column forms the directed graph)

Every status-changing action goes through this file FIRST.
Artifact files follow the backlog row, never lead it.
-->

# Backlog for {PROJECT}

> Single source of truth for project state and the artifact relation graph.
> Updated by every agent on every status-changing action, BEFORE the artifact
> body is touched.
>
> Cross-references: Bug rows (FIX-{ee}-{ff}-{nn}) live directly in this file
> under the affected Epic. Handoffs in HANDOFFS.md. Metrics in METRICS.md.

Last update: {YYYY-MM-DD} by {actor}

---

## Dashboard

| Status      | Count | | Phase      | Count |
|-------------|-------|-|------------|-------|
| Backlog     | 0     | | Released   | 0     |
| Ready       | 0     | | Building   | 0     |
| In Progress | 0     | | Planned    | 0     |
| In Review   | 0     | | Candidates | 0     |
| Done        | 0     | |            |       |

Counts are recomputed on every backlog write by the writing agent.

---

## Vocabulary

### Status (artifact lifecycle)

- `Backlog`: captured but not yet prioritized
- `Ready`: prioritized, scheduled for an iteration, free to be claimed
- `In Progress`: someone is actively working on this item
- `In Review`: PR open, awaiting review or quality gates
- `Done`: merged, finished

### Phase (epic-level temporal stage)

- `Released`: shipped to users
- `Building`: under active development
- `Planned`: scheduled for the next iteration
- `Candidates`: idea stage, needs refinement

### Type

- Feature, Epic, Improvement, Fix, Plan, ADR, Security

### Priority

- `P0`: blocker, immediate
- `P1`: short-term
- `P2`: mid-term
- `P3`: idea, not committed

### Claim

- Format: `{actor-name} @ {YYYY-MM-DD}`
- Empty cell means free

### Refs

- Comma-separated list of related artifact IDs forming the relation graph

---

## Active Epics

### EPIC-01: {Epic title}

Source: `_devprocess/requirements/epics/EPIC-01-{slug}.md`
Phase: Building | Target: {deadline}

| ID | Type | Title | Status | Phase | Prio | Refs | Source | Commit | Claim | Last change | Notes |
|----|------|-------|--------|-------|------|------|--------|--------|-------|-------------|-------|
| FEAT-01-01 | Feature | {title} | Ready | Building | P1 | EPIC-01 | BA | | | {date} | |

---

## Standalone Items (no Epic)

| ID | Type | Title | Status | Phase | Prio | Refs | Source | Commit | Claim | Last change | Notes |
|----|------|-------|--------|-------|------|------|--------|--------|-------|-------------|-------|

---

## Open Bugs (index)

| FIX-ID | Title | Prio | Status | Linked to |
|--------|-------|------|--------|-----------|

---

## Deferred / Ideas

| ID | Title | Reason | Revisit |
|----|-------|--------|---------|

---

## Writing rules for agents (binding)

1. Update the backlog row (status, phase, claim, last-change, refs)
2. Then update the artifact body with the substance change
3. Update commit SHA in the backlog row after the commit lands
4. Recompute the dashboard counts
5. Run consistency check at the end of the phase
