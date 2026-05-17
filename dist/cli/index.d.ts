/**
 * Nexus Framework - CLI Entry Point
 * Complete Multi-Agent Multi-User SDLC Orchestration CLI.
 *
 * Commands:
 * - init: Initialize Nexus in a project
 * - hooks: Install/uninstall git hooks
 * - preflight: Cross-agent conflict detection
 * - ownership: Unit ownership (claim/release/list)
 * - flight-record / flight-log / active-work: Flight recorder
 * - merge-order / merge-cleanup: Smart merge orchestrator
 * - adr: Architecture Decision Records
 * - backlog: Backlog management
 * - workflow: V-Model workflow (branch, phase-done, status)
 * - build-context: Cross-branch PR & ADR awareness
 * - skills: Skill discovery and phase routing
 * - session: Multi-agent session management
 * - status: Full project overview
 */
import { Command } from 'commander';
declare const program: Command;
export { program };
//# sourceMappingURL=index.d.ts.map