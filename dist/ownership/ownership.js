"use strict";
/**
 * Nexus Framework - Unit Ownership
 * Single-Writer Engine: Only the owner of a unit can modify it.
 * Uses SQLite INSERT OR IGNORE inside an IMMEDIATE transaction for atomic first-writer-wins semantics.
 * Claims can carry a lease (TTL): an expired lease no longer blocks others, so a crashed agent
 * cannot lock a unit forever. Owners keep long-running work alive via renew (heartbeat).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveClaimTtl = resolveClaimTtl;
exports.claim = claim;
exports.release = release;
exports.renew = renew;
exports.reapExpiredClaims = reapExpiredClaims;
exports.checkOwnership = checkOwnership;
exports.listAllClaims = listAllClaims;
const db_1 = require("../db");
/** Lease-Dauer aus --ttl oder NEXUS_CLAIM_TTL (Sekunden). Ohne Angabe: kein Ablauf. */
function resolveClaimTtl(ttl) {
    const raw = ttl ?? process.env.NEXUS_CLAIM_TTL;
    if (raw === undefined || raw === '')
        return undefined;
    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`Invalid claim TTL "${raw}" (expected a positive integer of seconds)`);
    }
    return value;
}
function leaseSuffix(expiresAt) {
    return expiresAt ? ` (lease until ${expiresAt} UTC)` : '';
}
function claim(unitKey, agentName, ttlSeconds) {
    const db = (0, db_1.getDatabase)();
    try {
        const result = (0, db_1.claimUnit)(db, unitKey, agentName, ttlSeconds);
        if (result.expiredOwner) {
            (0, db_1.logAudit)(db, {
                actor_name: agentName,
                action: 'unit_lease_expired',
                unit_key: unitKey,
                trigger_reason: `Lease of ${result.expiredOwner} on unit ${unitKey} had expired before ${agentName} claimed it`,
                result: 'success',
            });
        }
        (0, db_1.logAudit)(db, {
            actor_name: agentName,
            action: 'unit_claim',
            unit_key: unitKey,
            trigger_reason: `Agent ${agentName} claiming unit ${unitKey}`,
            result: result.success ? 'success' : 'blocked',
            error_message: result.success ? undefined : `Unit already claimed by ${result.owner}`,
        });
        if (result.success) {
            return {
                success: true,
                unit_key: unitKey,
                owner: agentName,
                message: `✅ Unit "${unitKey}" claimed by ${agentName}${leaseSuffix(result.expires_at)}`,
                expires_at: result.expires_at,
            };
        }
        else {
            return {
                success: false,
                unit_key: unitKey,
                owner: result.owner,
                message: `🚫 Unit "${unitKey}" is already claimed by ${result.owner}`,
            };
        }
    }
    finally {
        db.close();
    }
}
function release(unitKey, agentName) {
    const db = (0, db_1.getDatabase)();
    try {
        const currentOwner = (0, db_1.getUnitOwner)(db, unitKey);
        if (!currentOwner) {
            return {
                success: false,
                unit_key: unitKey,
                owner: '',
                message: `⚠️  Unit "${unitKey}" is not claimed by anyone`,
            };
        }
        if (currentOwner !== agentName) {
            (0, db_1.logAudit)(db, {
                actor_name: agentName,
                action: 'unit_release_denied',
                unit_key: unitKey,
                trigger_reason: `Agent ${agentName} tried to release unit owned by ${currentOwner}`,
                result: 'blocked',
                error_message: `Only the owner (${currentOwner}) can release this unit`,
            });
            return {
                success: false,
                unit_key: unitKey,
                owner: currentOwner,
                message: `🚫 Cannot release "${unitKey}" — owned by ${currentOwner}, not ${agentName}`,
            };
        }
        (0, db_1.releaseUnit)(db, unitKey, agentName);
        (0, db_1.logAudit)(db, {
            actor_name: agentName,
            action: 'unit_release',
            unit_key: unitKey,
            trigger_reason: `Agent ${agentName} releasing unit ${unitKey}`,
            result: 'success',
        });
        return {
            success: true,
            unit_key: unitKey,
            owner: '',
            message: `✅ Unit "${unitKey}" released by ${agentName}`,
        };
    }
    finally {
        db.close();
    }
}
function renew(unitKey, agentName, ttlSeconds) {
    const db = (0, db_1.getDatabase)();
    try {
        const expiresAt = (0, db_1.renewUnit)(db, unitKey, agentName, ttlSeconds);
        (0, db_1.logAudit)(db, {
            actor_name: agentName,
            action: 'unit_renew',
            unit_key: unitKey,
            trigger_reason: `Agent ${agentName} renewing lease on unit ${unitKey}`,
            result: expiresAt ? 'success' : 'blocked',
            error_message: expiresAt ? undefined : 'No active claim held by this agent',
        });
        if (!expiresAt) {
            const owner = (0, db_1.getUnitOwner)(db, unitKey) || '';
            return {
                success: false,
                unit_key: unitKey,
                owner,
                message: owner
                    ? `🚫 Cannot renew "${unitKey}" — owned by ${owner}, not ${agentName}`
                    : `⚠️  No active claim on "${unitKey}" (lease expired or released) — claim it again`,
            };
        }
        return {
            success: true,
            unit_key: unitKey,
            owner: agentName,
            message: `✅ Lease on "${unitKey}" renewed by ${agentName}${leaseSuffix(expiresAt)}`,
            expires_at: expiresAt,
        };
    }
    finally {
        db.close();
    }
}
/** Räumt abgelaufene Claims auf und protokolliert sie im Audit Log. */
function reapExpiredClaims(actorName = 'nexus-reaper') {
    const db = (0, db_1.getDatabase)();
    try {
        const expired = (0, db_1.purgeExpiredClaims)(db);
        for (const c of expired) {
            (0, db_1.logAudit)(db, {
                actor_name: actorName,
                action: 'unit_lease_expired',
                unit_key: c.unit_key,
                trigger_reason: `Lease of ${c.agent_name} expired at ${c.expires_at}`,
                result: 'success',
            });
        }
        return expired;
    }
    finally {
        db.close();
    }
}
function checkOwnership(unitKey, agentName) {
    const db = (0, db_1.getDatabase)();
    try {
        const owner = (0, db_1.getUnitOwner)(db, unitKey);
        if (!owner) {
            return { allowed: true, owner: null }; // No claim = open
        }
        return { allowed: owner === agentName, owner };
    }
    finally {
        db.close();
    }
}
function listAllClaims(agentName) {
    const db = (0, db_1.getDatabase)();
    try {
        return (0, db_1.listClaims)(db, agentName);
    }
    finally {
        db.close();
    }
}
//# sourceMappingURL=ownership.js.map