/**
 * Nexus Framework - V-Model Workflow Engine
 *
 * Implements the full V-Model lifecycle from DIA:
 * BA -> RE -> Architecture -> Coding -> Testing -> Security-Audit -> Release
 *
 * Combined with GSD-2 State-Machine Guards:
 * Every status transition is validated before execution.
 * Invalid transitions return errors instead of silently succeeding.
 */
export declare const V_MODEL_PHASES: readonly ["ba", "re", "arch", "code", "test", "sec", "review", "release"];
export type VModelPhase = typeof V_MODEL_PHASES[number];
export declare const ITEM_STATUSES: readonly ["NEW", "READY", "IN_PROGRESS", "IN_REVIEW", "DONE"];
export type ItemStatus = typeof ITEM_STATUSES[number];
export declare const EPIC_PHASES: readonly ["Candidates", "Planned", "Building", "Released"];
export type EpicPhase = typeof EPIC_PHASES[number];
export declare const ITEM_TYPES: readonly ["FEAT", "EPIC", "FIX", "IMP", "ADR", "PLAN"];
export type ItemType = typeof ITEM_TYPES[number];
/**
 * Validates a status transition. Returns null on success, error message on failure.
 * This is the GSD-2 "guard" pattern: precondition checks before any mutation.
 */
export declare function validateStatusTransition(currentStatus: ItemStatus, targetStatus: ItemStatus, itemId: string): string | null;
/**
 * Validates an epic phase transition.
 */
export declare function validatePhaseTransition(currentPhase: EpicPhase, targetPhase: EpicPhase, epicId: string): string | null;
/**
 * Phase tag schema: <item-id-lower>/<phase>-done
 * Example: feat-04-09/ba-done, feat-04-09/code-done
 */
export declare function buildPhaseTagName(itemId: string, phase: VModelPhase): string;
/**
 * Sets a phase tag on the current commit.
 * Tags are annotated (not lightweight) with a one-line message.
 */
export declare function setPhaseTag(itemId: string, phase: VModelPhase, message?: string): {
    success: boolean;
    tag: string;
    error?: string;
};
/**
 * Checks which phase tags exist for a given item.
 * Returns the list of completed phases.
 */
export declare function getCompletedPhases(itemId: string): VModelPhase[];
/**
 * Determines the next required phase for an item based on completed phases.
 */
export declare function getNextPhase(itemId: string, itemType: ItemType): VModelPhase | null;
/**
 * Returns the required V-Model phases for a given item type.
 * Not all items need all phases.
 */
export declare function getRequiredPhases(itemType: ItemType): VModelPhase[];
/**
 * Commit message format from DIA team-workflow:
 * <conventional-prefix>(<phase>): <ITEM-ID> <phase> complete
 *
 * Refs: <ITEM-ID>[, <other ids touched>]
 */
export declare function buildPhaseCommitMessage(itemId: string, phase: VModelPhase, summary: string, additionalRefs?: string[]): string;
export interface HandoffContext {
    itemId: string;
    phase: VModelPhase;
    actor: string;
    summary: string;
    artifactsProduced: string[];
    openQuestions: string[];
    nextPhase: VModelPhase | null;
    timestamp: string;
}
/**
 * Builds a handoff context object for the HANDOFFS.md log.
 * Every phase ends with a handoff that the next phase can pick up.
 */
export declare function buildHandoffContext(itemId: string, phase: VModelPhase, actor: string, summary: string, artifactsProduced: string[], openQuestions: string[], itemType: ItemType): HandoffContext;
/**
 * Formats a handoff context as markdown for HANDOFFS.md
 */
export declare function formatHandoffEntry(ctx: HandoffContext): string;
export interface ActorIdentity {
    name: string;
    type: 'agent' | 'human';
    session_id?: string;
}
/**
 * Validates that an actor identity is well-formed.
 */
export declare function validateActorIdentity(actor: ActorIdentity): string | null;
//# sourceMappingURL=v-model.d.ts.map