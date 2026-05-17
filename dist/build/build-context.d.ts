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
    readyBranches: ReadyBranch[];
    totalReadyForMerge: number;
    acceptedADRs: GlobalADR[];
    proposedADRs: GlobalADR[];
    dependencies: BranchDependency[];
    recommendedMergeOrder: string[];
    activeSessions: {
        actor: string;
        branch: string;
        itemId?: string;
        lastActivity: string;
    }[];
    inProgressItems: number;
    inReviewItems: number;
    doneNotMerged: number;
    warnings: string[];
}
/**
 * Scans the entire project state and produces a BuildContextReport.
 * This is the central intelligence that a build process or release agent calls.
 */
export declare function scanBuildContext(): BuildContextReport;
/**
 * Formats the BuildContextReport as a human-readable summary.
 * This is what gets printed to the console or passed to a CI/CD pipeline.
 */
export declare function formatBuildContextReport(report: BuildContextReport): string;
/**
 * Formats the BuildContextReport as JSON for CI/CD pipeline consumption.
 */
export declare function formatBuildContextJSON(report: BuildContextReport): string;
//# sourceMappingURL=build-context.d.ts.map