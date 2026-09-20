/**
 * Nexus Framework - Pre-Flight Check
 * Cross-Agent-Awareness: Before any agent starts planning, check what others are doing.
 */

import { getDatabase, getActiveWork, getFlightRecords, listADRs, getUnitOwner, listClaims, logAudit } from '../db';
import { execSync } from 'child_process';

export interface ConflictWarning {
  type: 'architecture' | 'code-overlap' | 'dependency' | 'ownership';
  severity: 'info' | 'warning' | 'critical';
  otherActor: string;
  otherBranch: string;
  affectedFiles: string[];
  suggestion: string;
}

export interface PreFlightResult {
  conflicts: ConflictWarning[];
  relevantADRs: Array<{ id: string; title: string; decision?: string }>;
  activeWork: Array<{ branch: string; actor: string; summary?: string }>;
  claimedUnits: Array<{ unit_key: string; agent_name: string }>;
  recommendation: 'proceed' | 'warn' | 'block';
  summary: string;
}

function getCurrentBranch(): string {
  try {
    return execSync('git branch --show-current 2>/dev/null', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

function getChangedFiles(branch?: string): string[] {
  try {
    if (branch) {
      const base = execSync('git merge-base HEAD develop 2>/dev/null || git merge-base HEAD main 2>/dev/null || echo HEAD~1', { encoding: 'utf-8' }).trim();
      return execSync(`git diff --name-only ${base}..HEAD 2>/dev/null`, { encoding: 'utf-8' }).trim().split('\n').filter(Boolean);
    }
    return execSync('git diff --name-only HEAD 2>/dev/null', { encoding: 'utf-8' }).trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function getBranchFiles(branch: string): string[] {
  try {
    const base = execSync(`git merge-base ${branch} develop 2>/dev/null || git merge-base ${branch} main 2>/dev/null`, { encoding: 'utf-8' }).trim();
    return execSync(`git diff --name-only ${base}..${branch} 2>/dev/null`, { encoding: 'utf-8' }).trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Normalizes a path or unit key before comparing scopes: surrounding whitespace,
 * backslashes (Windows), empty segments ("//", trailing "/") and the "." / ".."
 * segments are resolved. Without this, "src/auth/../payments" would still look
 * like a hit on a claim for "src/auth".
 */
export function normalizeScope(value: string): string {
  const segments: string[] = [];
  for (const segment of value.trim().replace(/\\/g, '/').split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      // A ".." that would escape the scope is kept, so the scope stays distinct
      // instead of silently collapsing onto the repository root.
      if (segments.length > 0 && segments[segments.length - 1] !== '..') segments.pop();
      else segments.push('..');
      continue;
    }
    segments.push(segment);
  }
  return segments.join('/');
}

/**
 * Two scopes overlap when they are equal or when one contains the other
 * as a directory. The comparison stops at path boundaries, so the unit
 * "src/auth" covers "src/auth/login.ts" but never "src/authority.ts".
 */
export function scopesOverlap(a: string, b: string): boolean {
  const left = normalizeScope(a);
  const right = normalizeScope(b);
  if (!left || !right) return false;
  return left === right || right.startsWith(`${left}/`) || left.startsWith(`${right}/`);
}

function findFileOverlaps(myFiles: string[], otherFiles: string[]): string[] {
  return otherFiles.filter(f => myFiles.some(mine => scopesOverlap(mine, f)));
}

export function runPreFlight(actorName: string, options?: {
  branch?: string;
  targetFiles?: string[];
  /** Units or paths the actor intends to touch — checked in addition to the files Git reports. */
  scope?: string[];
  quiet?: boolean;
}): PreFlightResult {
  const db = getDatabase();
  try {
    const currentBranch = options?.branch || getCurrentBranch();
    const declaredScope = (options?.scope || []).map(normalizeScope).filter(Boolean);
    const gitFiles = options?.targetFiles || getChangedFiles(currentBranch);
    // Declared scope first: an agent that is still planning has no changed files yet.
    const myFiles = [...new Set([...declaredScope, ...gitFiles])];
    const conflicts: ConflictWarning[] = [];

    // 1. Check active work from other agents/users
    const activeWork = getActiveWork(db);
    const otherWork = activeWork.filter(w => w.actor_name !== actorName && w.branch !== currentBranch);

    for (const work of otherWork) {
      if (work.branch) {
        const otherFiles = getBranchFiles(work.branch);
        const overlaps = findFileOverlaps(myFiles, otherFiles);

        if (overlaps.length > 0) {
          const isArchitectural = overlaps.some(f =>
            f.includes('ARCHITECTURE') || f.includes('ADR') || f.includes('schema') ||
            f.includes('config') || f.endsWith('.d.ts')
          );

          conflicts.push({
            type: isArchitectural ? 'architecture' : 'code-overlap',
            severity: isArchitectural ? 'critical' : 'warning',
            otherActor: work.actor_name,
            otherBranch: work.branch,
            affectedFiles: overlaps,
            suggestion: isArchitectural
              ? `CRITICAL: ${work.actor_name} is modifying architectural files on ${work.branch}. Coordinate before proceeding.`
              : `WARNING: ${work.actor_name} is working on overlapping files on ${work.branch}. Consider rebasing after their merge.`,
          });
        }
      }
    }

    // 2. Check unit ownership conflicts
    const claims = listClaims(db);
    const otherClaims = claims.filter(c => c.agent_name !== actorName);
    const claimedConflicts = otherClaims.filter(c => {
      // Check if any of my target files fall under a claimed unit (path-boundary aware)
      return myFiles.some(f => scopesOverlap(c.unit_key, f));
    });

    for (const claim of claimedConflicts) {
      conflicts.push({
        type: 'ownership',
        severity: 'critical',
        otherActor: claim.agent_name,
        otherBranch: '',
        affectedFiles: [claim.unit_key],
        suggestion: `BLOCKED: Unit "${claim.unit_key}" is claimed by ${claim.agent_name}. Wait for release or coordinate.`,
      });
    }

    // 3. Find relevant ADRs
    const allADRs = listADRs(db, 'accepted');
    const relevantADRs = allADRs.map(adr => ({
      id: adr.id,
      title: adr.title,
      decision: adr.decision || undefined,
    }));

    // 4. Determine recommendation
    let recommendation: PreFlightResult['recommendation'] = 'proceed';
    if (conflicts.some(c => c.severity === 'critical')) {
      recommendation = 'block';
    } else if (conflicts.some(c => c.severity === 'warning')) {
      recommendation = 'warn';
    }

    // 5. Build summary
    const summary = buildSummary(recommendation, conflicts, otherWork.length, relevantADRs.length);

    // 6. Log the pre-flight check
    logAudit(db, {
      actor_name: actorName,
      action: 'preflight_check',
      unit_key: currentBranch,
      trigger_reason: `Pre-flight for branch ${currentBranch}`,
      result: recommendation === 'block' ? 'blocked' : 'success',
      error_message: recommendation === 'block' ? conflicts.filter(c => c.severity === 'critical').map(c => c.suggestion).join('; ') : undefined,
    });

    return {
      conflicts,
      relevantADRs,
      activeWork: otherWork.map(w => ({ branch: w.branch || '', actor: w.actor_name, summary: w.summary || undefined })),
      claimedUnits: otherClaims,
      recommendation,
      summary,
    };
  } finally {
    db.close();
  }
}

function buildSummary(
  recommendation: PreFlightResult['recommendation'],
  conflicts: ConflictWarning[],
  activeCount: number,
  adrCount: number
): string {
  const lines: string[] = [];

  if (recommendation === 'proceed') {
    lines.push('✅ PRE-FLIGHT CHECK PASSED — No conflicts detected.');
  } else if (recommendation === 'warn') {
    lines.push('⚠️  PRE-FLIGHT CHECK WARNING — Potential conflicts detected.');
  } else {
    lines.push('🚫 PRE-FLIGHT CHECK BLOCKED — Critical conflicts detected.');
  }

  lines.push(`   Active parallel work: ${activeCount} other branch(es)`);
  lines.push(`   Relevant ADRs: ${adrCount}`);

  if (conflicts.length > 0) {
    lines.push('   Conflicts:');
    for (const c of conflicts) {
      lines.push(`     [${c.severity.toUpperCase()}] ${c.type}: ${c.suggestion}`);
    }
  }

  return lines.join('\n');
}
