"use strict";
/**
 * Nexus Framework - Unit Ownership
 * Single-Writer Engine: Only the owner of a unit can modify it.
 * Uses SQLite INSERT OR IGNORE for atomic first-writer-wins semantics.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.claim = claim;
exports.release = release;
exports.checkOwnership = checkOwnership;
exports.listAllClaims = listAllClaims;
const db_1 = require("../db");
function claim(unitKey, agentName) {
    const db = (0, db_1.getDatabase)();
    try {
        const result = (0, db_1.claimUnit)(db, unitKey, agentName);
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
                message: `✅ Unit "${unitKey}" claimed by ${agentName}`,
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