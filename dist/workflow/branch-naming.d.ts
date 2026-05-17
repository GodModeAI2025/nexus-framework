/**
 * Nexus Framework - Branch Naming & Protection
 *
 * Implements the DIA branch-naming convention:
 * One branch = one backlog item. Branch name derived from item ID.
 *
 * Combined with GSD-2 worktree lifecycle:
 * Branch creation, validation, and protection checks.
 */
import { ItemType } from './v-model';
/**
 * Branch naming schema from DIA team-workflow:
 *
 * | Item type | Pattern                              | Example                              |
 * |-----------|--------------------------------------|--------------------------------------|
 * | FEAT      | feature/<item-id-lower>-<short-slug> | feature/feat-04-09-openai-streaming  |
 * | EPIC      | feature/<item-id-lower>-<short-slug> | feature/epic-03-context-memory       |
 * | FIX       | fix/<item-id-lower>-<short-slug>     | fix/fix-12-04-01-copilot-embedding   |
 * | IMP       | chore/<item-id-lower>-<short-slug>   | chore/imp-08-02-03-better-logging    |
 */
export declare function deriveBranchName(itemId: string, itemType: ItemType, title: string): string;
/**
 * Slug derivation rules from DIA:
 * - Lower-case
 * - ASCII-only (umlauts to ae/oe/ue/ss)
 * - Hyphen-separated
 * - Drop articles
 * - Max 4 words, max 30 characters
 */
export declare function deriveSlug(title: string): string;
export interface BranchCheckResult {
    valid: boolean;
    currentBranch: string;
    expectedBranch: string;
    isProtected: boolean;
    message: string;
    recommendation: 'proceed' | 'switch' | 'block';
}
/**
 * Validates the current branch against the expected branch for an item.
 * Implements both the advisory (skill-start) and binding (commit-boundary) checks.
 */
export declare function checkBranch(itemId: string, itemType: ItemType, title: string, mode: 'advisory' | 'binding'): BranchCheckResult;
/**
 * Creates and switches to the expected branch for an item.
 */
export declare function createItemBranch(itemId: string, itemType: ItemType, title: string, baseBranch?: string): {
    success: boolean;
    branch: string;
    error?: string;
};
export interface WorktreeInfo {
    path: string;
    branch: string;
    itemId?: string;
    actor?: string;
    createdAt: string;
}
/**
 * Lists all active git worktrees and their associated items.
 */
export declare function listWorktrees(): WorktreeInfo[];
//# sourceMappingURL=branch-naming.d.ts.map