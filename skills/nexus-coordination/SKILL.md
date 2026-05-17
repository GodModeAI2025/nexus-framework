# Nexus Coordination Skill

Multi-Agent coordination rules that MUST be followed in every phase.

phases: [ba, re, arch, code, test, sec, review, release]

## Binding Rules for Every Agent

### Before Starting Any Work

1. **Identify yourself:** Set `NEXUS_ACTOR` environment variable or use `--actor` flag.
2. **Register session:** Run `nexus session start --actor <name> --branch <branch>`.
3. **Pre-flight check:** Run `nexus preflight --actor <name>`. This checks:
   - Are other agents working on overlapping files?
   - Are there accepted ADRs that constrain your work?
   - Are there ready PRs that should be merged first?
4. **Claim ownership:** Run `nexus ownership claim --unit <path>` for every directory you will modify.
5. **Verify branch:** Ensure you are on the correct feature branch for your backlog item.

### During Work

6. **Commit frequently:** Small, focused commits. The hooks record everything automatically.
7. **Update BACKLOG.md:** On every status change, update the backlog row FIRST, then the artifact.
8. **Respect ownership:** Never modify files in a unit claimed by another agent. If you need to, coordinate via `nexus preflight`.

### After Finishing Work

9. **Write handoff:** Append an entry to HANDOFFS.md with your summary, artifacts, and open questions.
10. **Set phase tag:** Run `nexus workflow phase-done --item <ID> --phase <phase>`.
11. **Release ownership:** Run `nexus ownership release --unit <path>`.
12. **Deregister session:** Run `nexus session end --actor <name>`.

### Conflict Resolution

- If `nexus preflight` reports a conflict, **STOP** and read the conflict details.
- If another agent owns a unit you need, **ASK** (via handoff or direct communication) before proceeding.
- If `nexus merge-order` shows your branch depends on another, wait for that branch to merge first.
- If you detect a stale session (>2h inactive), you may override with `--force` flag.

### Build & Release Context

- Before any release or build, run `nexus build-context` to see:
  - All branches ready for merge (with their PRs)
  - All accepted ADRs that constrain the build
  - Dependencies between ready branches
  - Recommended merge order
- The build process MUST respect the recommended merge order.
- The build process MUST validate that all accepted ADRs are satisfied.
