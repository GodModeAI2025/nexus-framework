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
/**
 * Normalizes a path or unit key before comparing scopes:
 * strips a leading "./", trailing slashes and surrounding whitespace.
 */
export declare function normalizeScope(value: string): string;
/**
 * Two scopes overlap when they are equal or when one contains the other
 * as a directory. The comparison stops at path boundaries, so the unit
 * "src/auth" covers "src/auth/login.ts" but never "src/authority.ts".
 */
export declare function scopesOverlap(a: string, b: string): boolean;
export declare function runPreFlight(actorName: string, options?: {
    branch?: string;
    targetFiles?: string[];
    /** Units or paths the actor intends to touch — checked in addition to the files Git reports. */
    scope?: string[];
    quiet?: boolean;
}): PreFlightResult;
//# sourceMappingURL=preflight.d.ts.map