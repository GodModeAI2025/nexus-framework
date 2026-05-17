/**
 * Nexus Framework - Git Hooks for Multi-Agent Multi-User SDLC
 *
 * These hooks fire automatically at every git event and ensure:
 * 1. Flight Recorder captures WHO did WHAT on WHICH branch
 * 2. Pre-commit validates branch protection and ownership
 * 3. Post-commit notifies other agents of changes
 * 4. Pre-push runs conflict detection across all active branches
 * 5. Post-merge cleans up stale claims and flight records
 * 6. Post-checkout detects context switches between items
 * 7. Prepare-commit-msg injects item references automatically
 *
 * Every hook is Multi-Agent aware: it reads the current actor from
 * the environment (NEXUS_ACTOR) or git config user.name.
 */
export declare function installHooks(projectRoot?: string): string[];
export declare function uninstallHooks(projectRoot?: string): string[];
export interface ActiveSession {
    actor: string;
    type: 'agent' | 'human';
    branch: string;
    itemId?: string;
    startedAt: string;
    lastActivity: string;
}
/**
 * Registers the current agent/user session in .nexus/active-sessions.json.
 * Other agents read this to know who is working where.
 */
export declare function registerSession(actor: string, branch: string, itemId?: string, actorType?: 'agent' | 'human'): void;
/**
 * Gets all active sessions (other agents currently working).
 */
export declare function getActiveSessions(excludeActor?: string): ActiveSession[];
/**
 * Deregisters a session when an agent finishes work.
 */
export declare function deregisterSession(actor: string): void;
//# sourceMappingURL=git-hooks.d.ts.map