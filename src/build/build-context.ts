/**
 * Nexus Framework - Build Context Scanner
 * 
 * Core Multi-Agent Innovation: Before any build or release, this scanner
 * provides a complete picture of:
 * 
 * 1. Which branches have finished PRs ready to merge (cross-branch awareness)
 * 2. Which ADRs are globally accepted and must be respected
 * 3. Which dependencies exist between ready branches
 * 4. Which agents are still actively working (and might conflict)
 * 
 * This is the "Zentrale Intelligenz" from the audio specification:
 * A build process can query what's ready across ALL branches,
 * not just the one it's currently on.
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { findProjectRoot, getDatabase, listADRs, listBacklog } from '../db';
import { getActiveSessions } from '../hooks/git-hooks';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReadyBranch {
  branch: string;
  itemId: string;
  title: string;
  status: string;
  actor: string;
  lastCommit: string;
  lastCommitDate: string;
  filesChanged: string[];
  hasOpenPR: boolean;
  prUrl?: string;
}

export interface GlobalADR {
  id: string;
  title: string;
  status: string;
  decision: string;
  affectsModules: string[];
  createdBy: string;
  createdAt: string;
}

export interface BranchDependency {
  branch: string;
  dependsOn: string[];
  reason: string;
}

export interface BuildContextReport {
  timestamp: string;
  projectRoot: string;
  currentBranch: string;

  // Cross-Branch Awareness
  readyBranches: ReadyBranch[];
  totalReadyForMerge: number;

  // Global ADR State
  acceptedADRs: GlobalADR[];
  proposedADRs: GlobalADR[];

  // Dependency Graph
  dependencies: BranchDependency[];
  recommendedMergeOrder: string[];

  // Active Work (other agents)
  activeSessions: { actor: string; branch: string; itemId?: string; lastActivity: string }[];

  // Backlog State
  inProgressItems: number;
  inReviewItems: number;
  doneNotMerged: number;

  // Warnings
  warnings: string[];
}

// ─── Scanner Implementation ───────────────────────────────────────────────────

/**
 * Scans the entire project state and produces a BuildContextReport.
 * This is the central intelligence that a build process or release agent calls.
 */
export function scanBuildContext(): BuildContextReport {
  const root = findProjectRoot();
  const currentBranch = getCurrentBranch();
  const warnings: string[] = [];

  // 1. Scan all remote branches for ready PRs
  const readyBranches = scanReadyBranches(root, warnings);

  // 2. Load global ADR state
  const { acceptedADRs, proposedADRs } = scanADRs(root);

  // 3. Compute dependency graph
  const dependencies = computeDependencies(readyBranches, root);

  // 4. Compute recommended merge order (topological sort)
  const recommendedMergeOrder = computeMergeOrder(readyBranches, dependencies);

  // 5. Get active sessions
  const activeSessions = getActiveSessions().map(s => ({
    actor: s.actor,
    branch: s.branch,
    itemId: s.itemId,
    lastActivity: s.lastActivity,
  }));

  // 6. Backlog state
  const backlogState = scanBacklogState(root);

  return {
    timestamp: new Date().toISOString(),
    projectRoot: root,
    currentBranch,
    readyBranches,
    totalReadyForMerge: readyBranches.length,
    acceptedADRs,
    proposedADRs,
    dependencies,
    recommendedMergeOrder,
    activeSessions,
    inProgressItems: backlogState.inProgress,
    inReviewItems: backlogState.inReview,
    doneNotMerged: backlogState.doneNotMerged,
    warnings,
  };
}

// ─── Sub-Scanners ─────────────────────────────────────────────────────────────

function getCurrentBranch(): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Scans all branches (local + remote) for those that are "ready" (In Review or Done).
 * Checks the backlog status AND whether a PR exists on GitHub.
 */
function scanReadyBranches(root: string, warnings: string[]): ReadyBranch[] {
  const readyBranches: ReadyBranch[] = [];

  // Get all branches (local and remote tracking)
  let allBranches: string[] = [];
  try {
    const output = execSync('git branch -a --format="%(refname:short)"', { encoding: 'utf-8' });
    allBranches = output.trim().split('\n').filter(b =>
      b.startsWith('feature/') || b.startsWith('fix/') || b.startsWith('chore/') ||
      b.startsWith('origin/feature/') || b.startsWith('origin/fix/') || b.startsWith('origin/chore/')
    );
    // Deduplicate (prefer local over remote)
    const localBranches = new Set(allBranches.filter(b => !b.startsWith('origin/')));
    allBranches = [...localBranches, ...allBranches.filter(b => b.startsWith('origin/') && !localBranches.has(b.replace('origin/', '')))];
  } catch {
    warnings.push('Could not list branches. Ensure git remote is configured.');
    return [];
  }

  // Check each branch for readiness
  const db = getDatabase();
  try {
    const backlog = listBacklog(db);

    for (const branch of allBranches) {
      const cleanBranch = branch.replace('origin/', '');

      // Extract item ID from branch name
      const itemId = extractItemIdFromBranch(cleanBranch);
      if (!itemId) continue;

      // Find corresponding backlog item
      const item = backlog.find(i => i.item_id.toLowerCase() === itemId.toLowerCase());
      if (!item) continue;

      // Only include items that are In Review or Done (but not yet merged)
      if (item.status !== 'IN_REVIEW' && item.status !== 'DONE') continue;

      // Get last commit info for this branch
      let lastCommit = '';
      let lastCommitDate = '';
      let filesChanged: string[] = [];
      try {
        lastCommit = execSync(`git log -1 --format="%H" ${branch} 2>/dev/null`, { encoding: 'utf-8' }).trim();
        lastCommitDate = execSync(`git log -1 --format="%ci" ${branch} 2>/dev/null`, { encoding: 'utf-8' }).trim();
        const filesOutput = execSync(`git diff --name-only main...${branch} 2>/dev/null || git diff --name-only HEAD...${branch} 2>/dev/null`, { encoding: 'utf-8' });
        filesChanged = filesOutput.trim().split('\n').filter(Boolean);
      } catch { /* ignore */ }

      // Check for open PR (via GitHub CLI if available)
      let hasOpenPR = false;
      let prUrl: string | undefined;
      try {
        const prOutput = execSync(`gh pr list --head "${cleanBranch}" --json url,state --limit 1 2>/dev/null`, { encoding: 'utf-8' });
        const prs = JSON.parse(prOutput);
        if (prs.length > 0) {
          hasOpenPR = prs[0].state === 'OPEN';
          prUrl = prs[0].url;
        }
      } catch { /* gh not available, skip */ }

      readyBranches.push({
        branch: cleanBranch,
        itemId: item.item_id,
        title: item.title,
        status: item.status,
        actor: item.claimed_by || 'unclaimed',
        lastCommit,
        lastCommitDate,
        filesChanged,
        hasOpenPR,
        prUrl,
      });
    }
  } finally {
    db.close();
  }

  return readyBranches;
}

/**
 * Extracts the item ID from a branch name.
 * feature/feat-01-02-slug -> FEAT-01-02
 * fix/fix-12-04-01-slug -> FIX-12-04-01
 */
function extractItemIdFromBranch(branch: string): string | null {
  const patterns = [
    /(?:feature|fix|chore)\/(feat-\d+-\d+)/i,
    /(?:feature|fix|chore)\/(epic-\d+)/i,
    /(?:feature|fix|chore)\/(fix-\d+-\d+-\d+)/i,
    /(?:feature|fix|chore)\/(imp-\d+-\d+-\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = branch.match(pattern);
    if (match) return match[1].toUpperCase();
  }

  return null;
}

/**
 * Scans the ADR database for accepted and proposed ADRs.
 */
function scanADRs(root: string): { acceptedADRs: GlobalADR[]; proposedADRs: GlobalADR[] } {
  const db = getDatabase();
  try {
    const accepted = listADRs(db, 'accepted').map(adr => ({
      id: adr.id,
      title: adr.title,
      status: adr.status,
      decision: adr.decision || '',
      affectsModules: extractModulesFromADR(adr.context || ''),
      createdBy: adr.created_by || 'unknown',
      createdAt: adr.created_at || '',
    }));

    const proposed = listADRs(db, 'proposed').map(adr => ({
      id: adr.id,
      title: adr.title,
      status: adr.status,
      decision: adr.decision || '',
      affectsModules: extractModulesFromADR(adr.context || ''),
      createdBy: adr.created_by || 'unknown',
      createdAt: adr.created_at || '',
    }));

    return { acceptedADRs: accepted, proposedADRs: proposed };
  } finally {
    db.close();
  }
}

/**
 * Extracts module references from ADR context text.
 */
function extractModulesFromADR(context: string): string[] {
  const modulePattern = /(?:src|lib|packages)\/[\w-]+/g;
  const matches = context.match(modulePattern);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Computes dependencies between ready branches based on file overlap.
 */
function computeDependencies(readyBranches: ReadyBranch[], root: string): BranchDependency[] {
  const dependencies: BranchDependency[] = [];

  for (let i = 0; i < readyBranches.length; i++) {
    const branch = readyBranches[i];
    const deps: string[] = [];
    const reasons: string[] = [];

    for (let j = 0; j < readyBranches.length; j++) {
      if (i === j) continue;
      const other = readyBranches[j];

      // Check file overlap
      const overlap = branch.filesChanged.filter(f => other.filesChanged.includes(f));
      if (overlap.length > 0) {
        deps.push(other.branch);
        reasons.push(`Shared files: ${overlap.slice(0, 3).join(', ')}${overlap.length > 3 ? '...' : ''}`);
      }
    }

    if (deps.length > 0) {
      dependencies.push({
        branch: branch.branch,
        dependsOn: deps,
        reason: reasons.join('; '),
      });
    }
  }

  return dependencies;
}

/**
 * Computes the recommended merge order using topological sort.
 * Branches with no dependencies come first.
 */
function computeMergeOrder(readyBranches: ReadyBranch[], dependencies: BranchDependency[]): string[] {
  const depMap = new Map<string, Set<string>>();
  const allBranches = readyBranches.map(b => b.branch);

  for (const branch of allBranches) {
    depMap.set(branch, new Set());
  }

  for (const dep of dependencies) {
    const existing = depMap.get(dep.branch) || new Set();
    for (const d of dep.dependsOn) {
      existing.add(d);
    }
    depMap.set(dep.branch, existing);
  }

  // Topological sort (Kahn's algorithm)
  const order: string[] = [];
  const inDegree = new Map<string, number>();
  const graph = new Map<string, string[]>();

  for (const branch of allBranches) {
    inDegree.set(branch, 0);
    graph.set(branch, []);
  }

  for (const [branch, deps] of depMap) {
    for (const dep of deps) {
      if (graph.has(dep)) {
        graph.get(dep)!.push(branch);
        inDegree.set(branch, (inDegree.get(branch) || 0) + 1);
      }
    }
  }

  const queue: string[] = [];
  for (const [branch, degree] of inDegree) {
    if (degree === 0) queue.push(branch);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);

    for (const neighbor of (graph.get(current) || [])) {
      const newDegree = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  // Add any remaining branches (circular dependencies)
  for (const branch of allBranches) {
    if (!order.includes(branch)) order.push(branch);
  }

  return order;
}

/**
 * Scans backlog state for summary counts.
 */
function scanBacklogState(root: string): { inProgress: number; inReview: number; doneNotMerged: number } {
  const db = getDatabase();
  try {
    const all = listBacklog(db);
    return {
      inProgress: all.filter(i => i.status === 'IN_PROGRESS').length,
      inReview: all.filter(i => i.status === 'IN_REVIEW').length,
      doneNotMerged: all.filter(i => i.status === 'DONE').length,
    };
  } finally {
    db.close();
  }
}

// ─── Report Formatting ────────────────────────────────────────────────────────

/**
 * Formats the BuildContextReport as a human-readable summary.
 * This is what gets printed to the console or passed to a CI/CD pipeline.
 */
export function formatBuildContextReport(report: BuildContextReport): string {
  const lines: string[] = [];

  lines.push('╔══════════════════════════════════════════════════════════════╗');
  lines.push('║           NEXUS BUILD CONTEXT REPORT                        ║');
  lines.push('╚══════════════════════════════════════════════════════════════╝');
  lines.push('');
  lines.push(`  Timestamp:      ${report.timestamp}`);
  lines.push(`  Current Branch: ${report.currentBranch}`);
  lines.push(`  Project Root:   ${report.projectRoot}`);
  lines.push('');

  // Ready Branches
  lines.push('─── READY FOR MERGE ─────────────────────────────────────────');
  if (report.readyBranches.length === 0) {
    lines.push('  No branches ready for merge.');
  } else {
    lines.push(`  ${report.totalReadyForMerge} branch(es) ready:`);
    lines.push('');
    for (const b of report.readyBranches) {
      const prTag = b.hasOpenPR ? ' [PR OPEN]' : '';
      lines.push(`  ${b.itemId}: ${b.title}`);
      lines.push(`    Branch: ${b.branch}${prTag}`);
      lines.push(`    Status: ${b.status} | Actor: ${b.actor}`);
      lines.push(`    Files:  ${b.filesChanged.length} changed`);
      if (b.prUrl) lines.push(`    PR:     ${b.prUrl}`);
      lines.push('');
    }
  }

  // ADRs
  lines.push('─── GLOBAL ADRs (ACCEPTED) ──────────────────────────────────');
  if (report.acceptedADRs.length === 0) {
    lines.push('  No accepted ADRs.');
  } else {
    for (const adr of report.acceptedADRs) {
      lines.push(`  ${adr.id}: ${adr.title}`);
      lines.push(`    Decision: ${adr.decision.substring(0, 100)}${adr.decision.length > 100 ? '...' : ''}`);
      if (adr.affectsModules.length > 0) {
        lines.push(`    Affects:  ${adr.affectsModules.join(', ')}`);
      }
      lines.push('');
    }
  }

  if (report.proposedADRs.length > 0) {
    lines.push('─── PROPOSED ADRs (PENDING DECISION) ────────────────────────');
    for (const adr of report.proposedADRs) {
      lines.push(`  ${adr.id}: ${adr.title} [PROPOSED by ${adr.createdBy}]`);
    }
    lines.push('');
  }

  // Dependencies & Merge Order
  if (report.dependencies.length > 0) {
    lines.push('─── BRANCH DEPENDENCIES ─────────────────────────────────────');
    for (const dep of report.dependencies) {
      lines.push(`  ${dep.branch} depends on:`);
      for (const d of dep.dependsOn) {
        lines.push(`    → ${d}`);
      }
      lines.push(`    Reason: ${dep.reason}`);
      lines.push('');
    }
  }

  if (report.recommendedMergeOrder.length > 0) {
    lines.push('─── RECOMMENDED MERGE ORDER ─────────────────────────────────');
    report.recommendedMergeOrder.forEach((branch, idx) => {
      lines.push(`  ${idx + 1}. ${branch}`);
    });
    lines.push('');
  }

  // Active Sessions
  if (report.activeSessions.length > 0) {
    lines.push('─── ACTIVE AGENTS ───────────────────────────────────────────');
    for (const s of report.activeSessions) {
      lines.push(`  ${s.actor} on ${s.branch}${s.itemId ? ` (${s.itemId})` : ''}`);
      lines.push(`    Last activity: ${s.lastActivity}`);
    }
    lines.push('');
  }

  // Backlog Summary
  lines.push('─── BACKLOG SUMMARY ─────────────────────────────────────────');
  lines.push(`  In Progress: ${report.inProgressItems}`);
  lines.push(`  In Review:   ${report.inReviewItems}`);
  lines.push(`  Done (not merged): ${report.doneNotMerged}`);
  lines.push('');

  // Warnings
  if (report.warnings.length > 0) {
    lines.push('─── WARNINGS ────────────────────────────────────────────────');
    for (const w of report.warnings) {
      lines.push(`  ⚠️  ${w}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Formats the BuildContextReport as JSON for CI/CD pipeline consumption.
 */
export function formatBuildContextJSON(report: BuildContextReport): string {
  return JSON.stringify(report, null, 2);
}
