"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ITEM_TYPES = exports.EPIC_PHASES = exports.ITEM_STATUSES = exports.V_MODEL_PHASES = void 0;
exports.validateStatusTransition = validateStatusTransition;
exports.validatePhaseTransition = validatePhaseTransition;
exports.buildPhaseTagName = buildPhaseTagName;
exports.setPhaseTag = setPhaseTag;
exports.getCompletedPhases = getCompletedPhases;
exports.getNextPhase = getNextPhase;
exports.getRequiredPhases = getRequiredPhases;
exports.buildPhaseCommitMessage = buildPhaseCommitMessage;
exports.buildHandoffContext = buildHandoffContext;
exports.formatHandoffEntry = formatHandoffEntry;
exports.validateActorIdentity = validateActorIdentity;
const child_process_1 = require("child_process");
// ─── V-Model Phase Definitions ────────────────────────────────────────────────
exports.V_MODEL_PHASES = [
    'ba', // Business Analysis
    're', // Requirements Engineering
    'arch', // Architecture
    'code', // Coding / Implementation
    'test', // Testing
    'sec', // Security Audit
    'review', // Ready for Review
    'release', // Released
];
// ─── Status Definitions (DIA-compatible) ──────────────────────────────────────
exports.ITEM_STATUSES = [
    'NEW', // Captured but not prioritized
    'READY', // Prioritized, free to claim
    'IN_PROGRESS', // Actively being worked on
    'IN_REVIEW', // PR open, awaiting review
    'DONE', // Merged, finished
];
// ─── Epic Phase (temporal stage) ──────────────────────────────────────────────
exports.EPIC_PHASES = [
    'Candidates', // Idea stage
    'Planned', // Scheduled for next iteration
    'Building', // Under active development
    'Released', // Shipped to users
];
// ─── Item Types ───────────────────────────────────────────────────────────────
exports.ITEM_TYPES = [
    'FEAT', // Feature
    'EPIC', // Epic
    'FIX', // Bug fix
    'IMP', // Improvement
    'ADR', // Architecture Decision Record
    'PLAN', // Implementation Plan
];
// ─── State Machine Guards (from GSD-2) ────────────────────────────────────────
/**
 * Valid status transitions. Any transition not listed here is rejected.
 * This prevents agents from corrupting state by skipping steps.
 */
const VALID_STATUS_TRANSITIONS = {
    'NEW': ['READY', 'DONE'], // Can be prioritized or cancelled
    'READY': ['IN_PROGRESS', 'NEW'], // Can be claimed or deprioritized
    'IN_PROGRESS': ['IN_REVIEW', 'READY', 'NEW'], // Can be submitted, unclaimed, or blocked
    'IN_REVIEW': ['DONE', 'IN_PROGRESS'], // Can be merged or sent back
    'DONE': ['IN_PROGRESS'], // Can be reopened (GSD-2 reopen pattern)
};
/**
 * Valid epic phase transitions.
 */
const VALID_PHASE_TRANSITIONS = {
    'Candidates': ['Planned'],
    'Planned': ['Building', 'Candidates'],
    'Building': ['Released', 'Planned'],
    'Released': [], // Terminal state
};
/**
 * Validates a status transition. Returns null on success, error message on failure.
 * This is the GSD-2 "guard" pattern: precondition checks before any mutation.
 */
function validateStatusTransition(currentStatus, targetStatus, itemId) {
    if (currentStatus === targetStatus) {
        return `Item ${itemId} is already in status "${currentStatus}".`;
    }
    const allowed = VALID_STATUS_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(targetStatus)) {
        return `Invalid transition for ${itemId}: "${currentStatus}" -> "${targetStatus}". ` +
            `Allowed from "${currentStatus}": [${(allowed || []).join(', ')}].`;
    }
    return null; // Valid
}
/**
 * Validates an epic phase transition.
 */
function validatePhaseTransition(currentPhase, targetPhase, epicId) {
    if (currentPhase === targetPhase) {
        return `Epic ${epicId} is already in phase "${currentPhase}".`;
    }
    const allowed = VALID_PHASE_TRANSITIONS[currentPhase];
    if (!allowed || !allowed.includes(targetPhase)) {
        return `Invalid phase transition for ${epicId}: "${currentPhase}" -> "${targetPhase}". ` +
            `Allowed from "${currentPhase}": [${(allowed || []).join(', ')}].`;
    }
    return null;
}
// ─── Phase Tags (DIA git tag pattern) ─────────────────────────────────────────
/**
 * Phase tag schema: <item-id-lower>/<phase>-done
 * Example: feat-04-09/ba-done, feat-04-09/code-done
 */
function buildPhaseTagName(itemId, phase) {
    return `${itemId.toLowerCase()}/${phase}-done`;
}
/**
 * Sets a phase tag on the current commit.
 * Tags are annotated (not lightweight) with a one-line message.
 */
function setPhaseTag(itemId, phase, message) {
    const tag = buildPhaseTagName(itemId, phase);
    const tagMessage = message || `${itemId} ${phase} phase complete`;
    try {
        (0, child_process_1.execSync)(`git tag -a "${tag}" -m "${tagMessage}"`, { stdio: 'pipe' });
        return { success: true, tag };
    }
    catch (e) {
        return { success: false, tag, error: e.message };
    }
}
/**
 * Checks which phase tags exist for a given item.
 * Returns the list of completed phases.
 */
function getCompletedPhases(itemId) {
    const prefix = `${itemId.toLowerCase()}/`;
    try {
        const output = (0, child_process_1.execSync)(`git tag -l "${prefix}*"`, { encoding: 'utf-8' });
        const tags = output.trim().split('\n').filter(Boolean);
        const completed = [];
        for (const phase of exports.V_MODEL_PHASES) {
            const expectedTag = buildPhaseTagName(itemId, phase);
            if (tags.includes(expectedTag)) {
                completed.push(phase);
            }
        }
        return completed;
    }
    catch {
        return [];
    }
}
/**
 * Determines the next required phase for an item based on completed phases.
 */
function getNextPhase(itemId, itemType) {
    const completed = getCompletedPhases(itemId);
    // Required phases depend on item type
    const requiredPhases = getRequiredPhases(itemType);
    for (const phase of requiredPhases) {
        if (!completed.includes(phase)) {
            return phase;
        }
    }
    return null; // All phases complete
}
/**
 * Returns the required V-Model phases for a given item type.
 * Not all items need all phases.
 */
function getRequiredPhases(itemType) {
    switch (itemType) {
        case 'FEAT':
            return ['ba', 're', 'arch', 'code', 'test', 'sec', 'review'];
        case 'EPIC':
            return ['ba', 're', 'arch'];
        case 'FIX':
            return ['code', 'test'];
        case 'IMP':
            return ['code', 'test'];
        case 'ADR':
            return ['arch'];
        case 'PLAN':
            return ['code'];
        default:
            return ['code', 'test'];
    }
}
// ─── Phase-End Commit (DIA binding contract) ──────────────────────────────────
/**
 * Commit message format from DIA team-workflow:
 * <conventional-prefix>(<phase>): <ITEM-ID> <phase> complete
 *
 * Refs: <ITEM-ID>[, <other ids touched>]
 */
function buildPhaseCommitMessage(itemId, phase, summary, additionalRefs) {
    const prefix = getConventionalPrefix(phase);
    const refs = [itemId, ...(additionalRefs || [])].join(', ');
    return `${prefix}(${phase}): ${itemId} ${phase} complete\n\n${summary}\n\nRefs: ${refs}`;
}
function getConventionalPrefix(phase) {
    switch (phase) {
        case 'ba':
        case 're':
        case 'arch':
        case 'sec':
        case 'review':
            return 'chore';
        case 'code':
            return 'feat';
        case 'test':
            return 'test';
        case 'release':
            return 'chore';
        default:
            return 'chore';
    }
}
/**
 * Builds a handoff context object for the HANDOFFS.md log.
 * Every phase ends with a handoff that the next phase can pick up.
 */
function buildHandoffContext(itemId, phase, actor, summary, artifactsProduced, openQuestions, itemType) {
    const completedPhases = getCompletedPhases(itemId);
    const requiredPhases = getRequiredPhases(itemType);
    const remaining = requiredPhases.filter(p => !completedPhases.includes(p) && p !== phase);
    const nextPhase = remaining.length > 0 ? remaining[0] : null;
    return {
        itemId,
        phase,
        actor,
        summary,
        artifactsProduced,
        openQuestions,
        nextPhase,
        timestamp: new Date().toISOString(),
    };
}
/**
 * Formats a handoff context as markdown for HANDOFFS.md
 */
function formatHandoffEntry(ctx) {
    const lines = [
        `## ${ctx.itemId} / ${ctx.phase}-done`,
        '',
        `**Actor:** ${ctx.actor}`,
        `**Timestamp:** ${ctx.timestamp}`,
        `**Summary:** ${ctx.summary}`,
        '',
        '**Artifacts produced:**',
        ...ctx.artifactsProduced.map(a => `- ${a}`),
        '',
    ];
    if (ctx.openQuestions.length > 0) {
        lines.push('**Open questions:**');
        lines.push(...ctx.openQuestions.map(q => `- ${q}`));
        lines.push('');
    }
    if (ctx.nextPhase) {
        lines.push(`**Next phase:** ${ctx.nextPhase}`);
    }
    else {
        lines.push('**Next phase:** All required phases complete. Ready for review.');
    }
    lines.push('');
    lines.push('---');
    lines.push('');
    return lines.join('\n');
}
/**
 * Validates that an actor identity is well-formed.
 */
function validateActorIdentity(actor) {
    if (!actor.name || actor.name.trim().length === 0) {
        return 'Actor name must not be empty.';
    }
    if (!['agent', 'human'].includes(actor.type)) {
        return 'Actor type must be "agent" or "human".';
    }
    return null;
}
//# sourceMappingURL=v-model.js.map