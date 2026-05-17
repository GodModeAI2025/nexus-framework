# Project Conventions Skill

Standard conventions for branch naming, commit messages, and documentation structure.

phases: [ba, re, arch, code, test, sec, review, release]

## Branch Naming Convention

Every branch is derived from a backlog item ID:

| Item Type | Branch Pattern | Example |
|-----------|---------------|---------|
| FEAT | `feature/<item-id-lower>-<slug>` | `feature/feat-04-09-openai-streaming` |
| EPIC | `feature/<epic-id-lower>-<slug>` | `feature/epic-03-context-memory` |
| FIX | `fix/<fix-id-lower>-<slug>` | `fix/fix-12-04-01-copilot-embedding` |
| IMP | `chore/<imp-id-lower>-<slug>` | `chore/imp-08-02-03-better-logging` |

### Slug Rules

- Lowercase, ASCII-only (umlauts to ae/oe/ue/ss)
- Hyphen-separated, drop articles (the, a, der, die, das)
- Max 4 words, max 30 characters

## Commit Message Convention

```
<type>(<phase>): <ITEM-ID> <summary>

<body>

Refs: <ITEM-ID>[, <other-ids>]
```

Types: `feat`, `fix`, `chore`, `test`, `docs`, `refactor`

The `prepare-commit-msg` hook auto-injects the `Refs:` line based on branch name.

## Three-Layer Documentation

1. **Wayfinder Layer** (`ARCHITECTURE.map`): Concept-to-file lookup. One row per concept.
2. **Guardrail Layer** (`ADR-*.md`): Architecture decisions. Binding constraints.
3. **Implementation Layer** (inline code docs): How the code works, in the code itself.

## File Structure Convention

```
_devprocess/
  requirements/
    epics/EPIC-{nn}-{slug}.md
    features/FEAT-{ee}-{ff}-{slug}.md
  architecture/
    ADR-{nnn}-{slug}.md
  plans/
    PLAN-{nn}-{slug}.md
BACKLOG.md          # Single source of truth
HANDOFFS.md         # Append-only phase transition log
ARCHITECTURE.map    # Wayfinder layer
```

## Protected Branches

- `main`, `master`: Production. Only via PR + review.
- `dev`, `develop`: Integration. Only via PR.
- Feature branches: Free to commit (with ownership).
