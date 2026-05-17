/**
 * Nexus Framework - Branch Naming & Protection
 * 
 * Implements the DIA branch-naming convention:
 * One branch = one backlog item. Branch name derived from item ID.
 * 
 * Combined with GSD-2 worktree lifecycle:
 * Branch creation, validation, and protection checks.
 */

import { execSync } from 'child_process';
import { ItemType } from './v-model';

// ─── Branch Name Derivation ───────────────────────────────────────────────────

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
export function deriveBranchName(itemId: string, itemType: ItemType, title: string): string {
  const prefix = getBranchPrefix(itemType);
  const slug = deriveSlug(title);
  const idLower = itemId.toLowerCase();

  return `${prefix}/${idLower}-${slug}`;
}

function getBranchPrefix(itemType: ItemType): string {
  switch (itemType) {
    case 'FEAT':
    case 'EPIC':
    case 'ADR':
      return 'feature';
    case 'FIX':
      return 'fix';
    case 'IMP':
    case 'PLAN':
      return 'chore';
    default:
      return 'feature';
  }
}

/**
 * Slug derivation rules from DIA:
 * - Lower-case
 * - ASCII-only (umlauts to ae/oe/ue/ss)
 * - Hyphen-separated
 * - Drop articles
 * - Max 4 words, max 30 characters
 */
export function deriveSlug(title: string): string {
  let slug = title.toLowerCase();

  // Replace umlauts
  slug = slug
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');

  // Remove non-ASCII
  slug = slug.replace(/[^a-z0-9\s-]/g, '');

  // Drop articles (DE + EN)
  const articles = ['the', 'a', 'an', 'der', 'die', 'das', 'ein', 'eine', 'and', 'und'];
  const words = slug.split(/\s+/).filter(w => !articles.includes(w) && w.length > 0);

  // Max 4 words
  slug = words.slice(0, 4).join('-');

  // Max 30 characters
  if (slug.length > 30) {
    slug = slug.substring(0, 30).replace(/-$/, '');
  }

  return slug;
}

// ─── Branch Protection ────────────────────────────────────────────────────────

const PROTECTED_BRANCHES = ['main', 'master', 'dev', 'develop'];

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
export function checkBranch(
  itemId: string,
  itemType: ItemType,
  title: string,
  mode: 'advisory' | 'binding'
): BranchCheckResult {
  const expectedBranch = deriveBranchName(itemId, itemType, title);
  let currentBranch: string;

  try {
    currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return {
      valid: false,
      currentBranch: '(unknown)',
      expectedBranch,
      isProtected: false,
      message: 'Not in a git repository.',
      recommendation: 'block',
    };
  }

  const isProtected = PROTECTED_BRANCHES.includes(currentBranch);

  // Exact match
  if (currentBranch === expectedBranch) {
    return {
      valid: true,
      currentBranch,
      expectedBranch,
      isProtected: false,
      message: `Branch "${currentBranch}" matches item ${itemId}.`,
      recommendation: 'proceed',
    };
  }

  // Protected branch
  if (isProtected) {
    const msg = mode === 'binding'
      ? `BLOCKED: Cannot commit on protected branch "${currentBranch}". Create "${expectedBranch}" first.`
      : `WARNING: On protected branch "${currentBranch}". Work for ${itemId} needs branch "${expectedBranch}".`;

    return {
      valid: false,
      currentBranch,
      expectedBranch,
      isProtected: true,
      message: msg,
      recommendation: mode === 'binding' ? 'block' : 'switch',
    };
  }

  // Wrong feature branch
  return {
    valid: false,
    currentBranch,
    expectedBranch,
    isProtected: false,
    message: `On branch "${currentBranch}", but item ${itemId} expects "${expectedBranch}".`,
    recommendation: 'switch',
  };
}

/**
 * Creates and switches to the expected branch for an item.
 */
export function createItemBranch(
  itemId: string,
  itemType: ItemType,
  title: string,
  baseBranch?: string
): { success: boolean; branch: string; error?: string } {
  const branch = deriveBranchName(itemId, itemType, title);

  try {
    // Check if branch already exists
    try {
      execSync(`git rev-parse --verify "${branch}"`, { stdio: 'pipe' });
      // Branch exists, just switch
      execSync(`git checkout "${branch}"`, { stdio: 'pipe' });
      return { success: true, branch };
    } catch {
      // Branch does not exist, create it
      const base = baseBranch || 'HEAD';
      execSync(`git checkout -b "${branch}" ${base}`, { stdio: 'pipe' });
      return { success: true, branch };
    }
  } catch (e: any) {
    return { success: false, branch, error: e.message };
  }
}

// ─── Worktree Lifecycle (GSD-2 pattern) ───────────────────────────────────────

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
export function listWorktrees(): WorktreeInfo[] {
  try {
    const output = execSync('git worktree list --porcelain', { encoding: 'utf-8' });
    const worktrees: WorktreeInfo[] = [];
    let current: Partial<WorktreeInfo> = {};

    for (const line of output.split('\n')) {
      if (line.startsWith('worktree ')) {
        if (current.path) worktrees.push(current as WorktreeInfo);
        current = { path: line.replace('worktree ', ''), createdAt: new Date().toISOString() };
      } else if (line.startsWith('branch ')) {
        current.branch = line.replace('branch refs/heads/', '');
      }
    }

    if (current.path) worktrees.push(current as WorktreeInfo);
    return worktrees;
  } catch {
    return [];
  }
}
