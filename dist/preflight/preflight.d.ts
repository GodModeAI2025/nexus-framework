/**
 * Nexus Framework - Pre-Flight Check
 * Cross-Agent-Awareness: Before any agent starts planning, check what others are doing.
 */
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
    relevantADRs: Array<{
        id: string;
        title: string;
        decision?: string;
    }>;
    activeWork: Array<{
        branch: string;
        actor: string;
        summary?: string;
    }>;
    claimedUnits: Array<{
        unit_key: string;
        agent_name: string;
    }>;
    recommendation: 'proceed' | 'warn' | 'block';
    summary: string;
}
export declare function runPreFlight(actorName: string, options?: {
    branch?: string;
    targetFiles?: string[];
    quiet?: boolean;
}): PreFlightResult;
//# sourceMappingURL=preflight.d.ts.map