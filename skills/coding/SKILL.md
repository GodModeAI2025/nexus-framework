# Coding Skill

Implementation guidelines for the CODE phase of the V-Model.

phases: [code]

## Pre-Conditions (MUST verify before writing code)

1. The ARCH phase is complete (phase tag `<item-id>/arch-done` exists).
2. An ADR exists that defines the technical approach.
3. You have claimed ownership of all units you will modify.
4. Pre-flight check shows no conflicts.

## Implementation Rules

### Code Quality

- Follow existing code style in the project (detect from existing files).
- Write self-documenting code with meaningful names.
- Add inline comments only for non-obvious logic (Implementation Layer).
- Keep functions small and focused (max ~50 lines).
- Handle errors explicitly, never swallow exceptions silently.

### Multi-Agent Safety

- **Only modify files in units you own.** If you need to change a shared utility, coordinate first.
- **Commit after each logical unit of work.** The hooks record your progress for other agents.
- **Update ARCHITECTURE.map** if you create new entry-points or modules.
- **Do NOT refactor code outside your scope.** Create an IMP item for that.

### Testing Integration

- Write unit tests alongside implementation (same commit or immediately after).
- Tests live in a parallel directory structure: `src/module/` -> `tests/module/`.
- Minimum: one test per public function/method.

## Post-Conditions (MUST complete before handoff)

1. All new code compiles without errors.
2. Existing tests still pass.
3. ARCHITECTURE.map is updated with new entry-points.
4. BACKLOG.md row is updated (Status: In Review).
5. HANDOFFS.md entry is written for the TEST phase.
6. Phase tag is set: `nexus workflow phase-done --item <ID> --phase code`.
7. Ownership is released.

## Commit Pattern

```
feat(code): FEAT-04-09 implement OpenAI streaming adapter

- Add StreamingAdapter class with backpressure handling
- Integrate with existing EventBus via observer pattern
- Update ARCHITECTURE.map with new entry-point

Refs: FEAT-04-09, ADR-007
```
