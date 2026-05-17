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

import { execSync } from 'child_process';

// ─── V-Model Phase Definitions ────────────────────────────────────────────────

export const V_MODEL_PHASES = [
  'ba',           // Business Analysis
  're',           // Requirements Engineering
  'arch',         // Architecture
  'code',         // Coding / Implementation
  'test',         // Testing
  'sec',          // Security Audit
  'review',       // Ready for Review
  'release',      // Released
] as const;

export type VModelPhase = typeof V_MODEL_PHASES[number];

// ─── Status Definitions (DIA-compatible) ──────────────────────────────────────

export const ITEM_STATUSES = [
  'NEW',          // Captured but not prioritized
  'READY',        // Prioritized, free to claim
  'IN_PROGRESS',  // Actively being worked on
  'IN_REVIEW',    // PR open, awaiting review
  'DONE',         // Merged, finished
] as const;

export type ItemStatus = typeof ITEM_STATUSES[number];

// ─── Epic Phase (temporal stage) ──────────────────────────────────────────────

export const EPIC_PHASES = [
  'Candidates',   // Idea stage
  'Planned',      // Scheduled for next iteration
  'Building',     // Under active development
  'Released',     // Shipped to users
] as const;

export type EpicPhase = typeof EPIC_PHASES[number];

// ─── Item Types ───────────────────────────────────────────────────────────────

export const ITEM_TYPES = [
  'FEAT',   // Feature
  'EPIC',   // Epic
  'FIX',    // Bug fix
  'IMP',    // Improvement
  'ADR',    // Architecture Decision Record
  'PLAN',   // Implementation Plan
] as const;

export type ItemType = typeof ITEM_TYPES[number];

// ─── State Machine Guards (from GSD-2) ────────────────────────────────────────

/**
 * Valid status transitions. Any transition not listed here is rejected.
 * This prevents agents from corrupting state by skipping steps.
 */
const VALID_STATUS_TRANSITIONS: Record<ItemStatus, ItemStatus[]> = {
  'NEW':         ['READY', 'DONE'],                        // Can be prioritized or cancelled
  'READY':       ['IN_PROGRESS', 'NEW'],                   // Can be claimed or deprioritized
  'IN_PROGRESS': ['IN_REVIEW', 'READY', 'NEW'],            // Can be submitted, unclaimed, or blocked
  'IN_REVIEW':   ['DONE', 'IN_PROGRESS'],                  // Can be merged or sent back
  'DONE':        ['IN_PROGRESS'],                          // Can be reopened (GSD-2 reopen pattern)
};

/**
 * Valid epic phase transitions.
 */
const VALID_PHASE_TRANSITIONS: Record<EpicPhase, EpicPhase[]> = {
  'Candidates': ['Planned'],
  'Planned':    ['Building', 'Candidates'],
  'Building':   ['Released', 'Planned'],
  'Released':   [],  // Terminal state
};

/**
 * Validates a status transition. Returns null on success, error message on failure.
 * This is the GSD-2 "guard" pattern: precondition checks before any mutation.
 */
export function validateStatusTransition(
  currentStatus: ItemStatus,
  targetStatus: ItemStatus,
  itemId: string
): string | null {
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
export function validatePhaseTransition(
  currentPhase: EpicPhase,
  targetPhase: EpicPhase,
  epicId: string
): string | null {
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
export function buildPhaseTagName(itemId: string, phase: VModelPhase): string {
  return `${itemId.toLowerCase()}/${phase}-done`;
}

/**
 * Sets a phase tag on the current commit.
 * Tags are annotated (not lightweight) with a one-line message.
 */
export function setPhaseTag(
  itemId: string,
  phase: VModelPhase,
  message?: string
): { success: boolean; tag: string; error?: string } {
  const tag = buildPhaseTagName(itemId, phase);
  const tagMessage = message || `${itemId} ${phase} phase complete`;

  try {
    execSync(`git tag -a "${tag}" -m "${tagMessage}"`, { stdio: 'pipe' });
    return { success: true, tag };
  } catch (e: any) {
    return { success: false, tag, error: e.message };
  }
}

/**
 * Checks which phase tags exist for a given item.
 * Returns the list of completed phases.
 */
export function getCompletedPhases(itemId: string): VModelPhase[] {
  const prefix = `${itemId.toLowerCase()}/`;
  try {
    const output = execSync(`git tag -l "${prefix}*"`, { encoding: 'utf-8' });
    const tags = output.trim().split('\n').filter(Boolean);
    const completed: VModelPhase[] = [];

    for (const phase of V_MODEL_PHASES) {
      const expectedTag = buildPhaseTagName(itemId, phase);
      if (tags.includes(expectedTag)) {
        completed.push(phase);
      }
    }

    return completed;
  } catch {
    return [];
  }
}

/**
 * Determines the next required phase for an item based on completed phases.
 */
export function getNextPhase(itemId: string, itemType: ItemType): VModelPhase | null {
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
export function getRequiredPhases(itemType: ItemType): VModelPhase[] {
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
export function buildPhaseCommitMessage(
  itemId: string,
  phase: VModelPhase,
  summary: string,
  additionalRefs?: string[]
): string {
  const prefix = getConventionalPrefix(phase);
  const refs = [itemId, ...(additionalRefs || [])].join(', ');

  return `${prefix}(${phase}): ${itemId} ${phase} complete\n\n${summary}\n\nRefs: ${refs}`;
}

function getConventionalPrefix(phase: VModelPhase): string {
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

// ─── Handoff Ritual ───────────────────────────────────────────────────────────

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
export function buildHandoffContext(
  itemId: string,
  phase: VModelPhase,
  actor: string,
  summary: string,
  artifactsProduced: string[],
  openQuestions: string[],
  itemType: ItemType
): HandoffContext {
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
export function formatHandoffEntry(ctx: HandoffContext): string {
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
  } else {
    lines.push('**Next phase:** All required phases complete. Ready for review.');
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  return lines.join('\n');
}

// ─── Actor Identity (GSD-2 Stream 2) ─────────────────────────────────────────

export interface ActorIdentity {
  name: string;          // e.g., "claude-opus-4", "user-sebastian"
  type: 'agent' | 'human';
  session_id?: string;
}

/**
 * Validates that an actor identity is well-formed.
 */
export function validateActorIdentity(actor: ActorIdentity): string | null {
  if (!actor.name || actor.name.trim().length === 0) {
    return 'Actor name must not be empty.';
  }
  if (!['agent', 'human'].includes(actor.type)) {
    return 'Actor type must be "agent" or "human".';
  }
  return null;
}
