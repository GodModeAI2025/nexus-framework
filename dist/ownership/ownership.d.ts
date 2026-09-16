/**
 * Nexus Framework - Unit Ownership
 * Single-Writer Engine: Only the owner of a unit can modify it.
 * Uses SQLite INSERT OR IGNORE inside an IMMEDIATE transaction for atomic first-writer-wins semantics.
 * Claims can carry a lease (TTL): an expired lease no longer blocks others, so a crashed agent
 * cannot lock a unit forever. Owners keep long-running work alive via renew (heartbeat).
 */
export interface ClaimResult {
    success: boolean;
    unit_key: string;
    owner: string;
    message: string;
    expires_at?: string | null;
}
/** Lease-Dauer aus --ttl oder NEXUS_CLAIM_TTL (Sekunden). Ohne Angabe: kein Ablauf. */
export declare function resolveClaimTtl(ttl?: string | number): number | undefined;
export declare function claim(unitKey: string, agentName: string, ttlSeconds?: number): ClaimResult;
export declare function release(unitKey: string, agentName: string): ClaimResult;
export declare function renew(unitKey: string, agentName: string, ttlSeconds: number): ClaimResult;
/** Räumt abgelaufene Claims auf und protokolliert sie im Audit Log. */
export declare function reapExpiredClaims(actorName?: string): import("../db").UnitClaim[];
export declare function checkOwnership(unitKey: string, agentName: string): {
    allowed: boolean;
    owner: string | null;
};
export declare function listAllClaims(agentName?: string): import("../db").UnitClaim[];
//# sourceMappingURL=ownership.d.ts.map