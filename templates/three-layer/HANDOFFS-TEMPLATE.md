<!--
Nexus Framework - Handoffs Log Template
Append-only. Each phase writes one entry at the end of its run.
Used by the next agent/phase to pick up context without re-reading all artifacts.
-->

# Handoffs Log for {PROJECT}

> Append-only audit trail of phase transitions.
> Each phase skill writes one entry with: artifacts produced,
> handoff context (open questions, assumptions, risks), and next phase.

---

## Template for each entry

```
## {ITEM-ID} / {phase}-done

**Actor:** {actor-name}
**Timestamp:** {ISO-8601}
**Summary:** {one-line summary of what the phase delivered}

**Artifacts produced:**
- {artifact-1}
- {artifact-2}

**Open questions:**
- {question-1}

**Next phase:** {next-phase or "All required phases complete"}

---
```
