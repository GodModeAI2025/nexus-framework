/**
 * Nexus Framework - Smart Merge Orchestrator
 * Analyzes branch dependencies, detects conflicts before merge,
 * and determines optimal merge order.
 */
export interface BranchInfo {
    name: string;
    actor: string;
    filesChanged: string[];
    commitCount: number;
    basedOn: string;
    lastActivity: string;
}
export interface MergeConflict {
    branchA: string;
    branchB: string;
    conflictingFiles: string[];
    type: 'direct' | 'architectural' | 'semantic';
    resolution: string;
}
export interface MergeOrder {
    sequence: string[];
    conflicts: MergeConflict[];
    recommendations: string[];
}
export declare function analyzeMergeOrder(): MergeOrder;
export declare function mergeCleanup(branch: string): {
    cleaned: number;
    message: string;
};
//# sourceMappingURL=smart-merge.d.ts.map