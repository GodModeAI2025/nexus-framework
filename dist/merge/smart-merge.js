"use strict";
/**
 * Nexus Framework - Smart Merge Orchestrator
 * Analyzes branch dependencies, detects conflicts before merge,
 * and determines optimal merge order.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeMergeOrder = analyzeMergeOrder;
exports.mergeCleanup = mergeCleanup;
const child_process_1 = require("child_process");
const db_1 = require("../db");
function execGit(cmd) {
    try {
        return (0, child_process_1.execSync)(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    }
    catch {
        return '';
    }
}
function getLocalBranches() {
    const output = execGit('git branch --format="%(refname:short)"');
    return output.split('\n').filter(b => b && !['main', 'master', 'develop', 'dev'].includes(b));
}
function getBranchInfo(branch) {
    try {
        const baseBranch = execGit('git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null') || 'develop';
        const base = execGit(`git merge-base ${branch} develop 2>/dev/null`) ||
            execGit(`git merge-base ${branch} main 2>/dev/null`) ||
            execGit(`git merge-base ${branch} master 2>/dev/null`);
        if (!base)
            return null;
        const files = execGit(`git diff --name-only ${base}..${branch}`).split('\n').filter(Boolean);
        const commitCount = parseInt(execGit(`git rev-list --count ${base}..${branch}`) || '0');
        const lastActivity = execGit(`git log -1 --format=%ci ${branch}`);
        const actor = execGit(`git log -1 --format=%an ${branch}`);
        return {
            name: branch,
            actor,
            filesChanged: files,
            commitCount,
            basedOn: base,
            lastActivity,
        };
    }
    catch {
        return null;
    }
}
function detectConflicts(branches) {
    const conflicts = [];
    for (let i = 0; i < branches.length; i++) {
        for (let j = i + 1; j < branches.length; j++) {
            const a = branches[i];
            const b = branches[j];
            // Find overlapping files
            const aFiles = new Set(a.filesChanged);
            const overlapping = b.filesChanged.filter(f => aFiles.has(f));
            if (overlapping.length > 0) {
                // Determine conflict type
                const isArchitectural = overlapping.some(f => f.includes('schema') || f.includes('ARCHITECTURE') || f.includes('migration') ||
                    f.includes('config') || f.endsWith('.d.ts') || f.includes('ADR'));
                const type = isArchitectural ? 'architectural' : 'direct';
                const resolution = isArchitectural
                    ? `Merge "${a.name}" FIRST (architectural changes), then rebase "${b.name}" onto new develop.`
                    : `Merge "${a.name}" first (more commits: ${a.commitCount}), then resolve conflicts in "${b.name}".`;
                conflicts.push({
                    branchA: a.name,
                    branchB: b.name,
                    conflictingFiles: overlapping,
                    type,
                    resolution,
                });
            }
        }
    }
    return conflicts;
}
function determineMergeOrder(branches, conflicts) {
    // Score each branch: higher score = merge first
    const scores = new Map();
    for (const branch of branches) {
        let score = 0;
        // Architectural changes get priority (merge first to establish new base)
        const hasArchitectural = branch.filesChanged.some(f => f.includes('schema') || f.includes('ARCHITECTURE') || f.includes('migration') ||
            f.includes('config') || f.endsWith('.d.ts'));
        if (hasArchitectural)
            score += 100;
        // More commits = more established work = merge first
        score += branch.commitCount * 2;
        // More files changed = bigger impact = merge first
        score += branch.filesChanged.length;
        // Branches involved in conflicts as "A" (first mentioned) get priority
        const conflictsAsA = conflicts.filter(c => c.branchA === branch.name);
        score += conflictsAsA.length * 50;
        scores.set(branch.name, score);
    }
    // Sort by score descending
    return [...scores.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name);
}
function analyzeMergeOrder() {
    const db = (0, db_1.getDatabase)();
    try {
        const localBranches = getLocalBranches();
        const branches = [];
        for (const branchName of localBranches) {
            const info = getBranchInfo(branchName);
            if (info && info.filesChanged.length > 0) {
                branches.push(info);
            }
        }
        if (branches.length === 0) {
            return {
                sequence: [],
                conflicts: [],
                recommendations: ['No active feature branches found.'],
            };
        }
        const conflicts = detectConflicts(branches);
        const sequence = determineMergeOrder(branches, conflicts);
        const recommendations = [];
        if (conflicts.length === 0) {
            recommendations.push('✅ No conflicts detected. Branches can be merged in any order.');
        }
        else {
            recommendations.push(`⚠️  ${conflicts.length} potential conflict(s) detected.`);
            recommendations.push('Recommended merge order (highest priority first):');
            sequence.forEach((branch, i) => {
                recommendations.push(`  ${i + 1}. ${branch}`);
            });
            recommendations.push('');
            for (const conflict of conflicts) {
                recommendations.push(`  Conflict: ${conflict.branchA} ↔ ${conflict.branchB}`);
                recommendations.push(`    Files: ${conflict.conflictingFiles.join(', ')}`);
                recommendations.push(`    Resolution: ${conflict.resolution}`);
            }
        }
        // Log the analysis
        (0, db_1.logAudit)(db, {
            actor_name: 'nexus-merge-orchestrator',
            action: 'merge_analysis',
            trigger_reason: `Analyzed ${branches.length} branches, found ${conflicts.length} conflicts`,
            result: conflicts.length > 0 ? 'blocked' : 'success',
        });
        return { sequence, conflicts, recommendations };
    }
    finally {
        db.close();
    }
}
function mergeCleanup(branch) {
    const db = (0, db_1.getDatabase)();
    try {
        // Delete flight recorder entries for the merged branch
        const stmt = db.prepare('DELETE FROM flight_recorder WHERE branch = ?');
        const result = stmt.run(branch);
        // Release any unit claims associated with this branch
        const claims = db.prepare('SELECT unit_key, agent_name FROM unit_claims WHERE unit_key LIKE ?').all(`%${branch}%`);
        for (const claim of claims) {
            db.prepare('DELETE FROM unit_claims WHERE unit_key = ?').run(claim.unit_key);
        }
        (0, db_1.logAudit)(db, {
            actor_name: 'nexus-system',
            action: 'merge_cleanup',
            unit_key: branch,
            trigger_reason: `Post-merge cleanup for branch ${branch}`,
            result: 'success',
        });
        return {
            cleaned: result.changes,
            message: `✅ Cleaned up ${result.changes} flight records for branch "${branch}"`,
        };
    }
    finally {
        db.close();
    }
}
//# sourceMappingURL=smart-merge.js.map