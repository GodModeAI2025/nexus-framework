/**
 * Nexus Framework - Unit Ownership
 * Single-Writer Engine: Only the owner of a unit can modify it.
 * Uses SQLite INSERT OR IGNORE for atomic first-writer-wins semantics.
 */
export interface ClaimResult {
    success: boolean;
    unit_key: string;
    owner: string;
    message: string;
}
export declare function claim(unitKey: string, agentName: string): ClaimResult;
export declare function release(unitKey: string, agentName: string): ClaimResult;
export declare function checkOwnership(unitKey: string, agentName: string): {
    allowed: boolean;
    owner: string | null;
};
export declare function listAllClaims(agentName?: string): import("../db").UnitClaim[];
//# sourceMappingURL=ownership.d.ts.map