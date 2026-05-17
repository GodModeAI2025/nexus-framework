/**
 * Nexus Framework - Unit Ownership
 * Single-Writer Engine: Only the owner of a unit can modify it.
 * Uses SQLite INSERT OR IGNORE for atomic first-writer-wins semantics.
 */

import { getDatabase, claimUnit, releaseUnit, getUnitOwner, listClaims, logAudit } from '../db';

export interface ClaimResult {
  success: boolean;
  unit_key: string;
  owner: string;
  message: string;
}

export function claim(unitKey: string, agentName: string): ClaimResult {
  const db = getDatabase();
  try {
    const result = claimUnit(db, unitKey, agentName);

    logAudit(db, {
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
    } else {
      return {
        success: false,
        unit_key: unitKey,
        owner: result.owner!,
        message: `🚫 Unit "${unitKey}" is already claimed by ${result.owner}`,
      };
    }
  } finally {
    db.close();
  }
}

export function release(unitKey: string, agentName: string): ClaimResult {
  const db = getDatabase();
  try {
    const currentOwner = getUnitOwner(db, unitKey);

    if (!currentOwner) {
      return {
        success: false,
        unit_key: unitKey,
        owner: '',
        message: `⚠️  Unit "${unitKey}" is not claimed by anyone`,
      };
    }

    if (currentOwner !== agentName) {
      logAudit(db, {
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

    releaseUnit(db, unitKey, agentName);

    logAudit(db, {
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
  } finally {
    db.close();
  }
}

export function checkOwnership(unitKey: string, agentName: string): { allowed: boolean; owner: string | null } {
  const db = getDatabase();
  try {
    const owner = getUnitOwner(db, unitKey);
    if (!owner) {
      return { allowed: true, owner: null }; // No claim = open
    }
    return { allowed: owner === agentName, owner };
  } finally {
    db.close();
  }
}

export function listAllClaims(agentName?: string) {
  const db = getDatabase();
  try {
    return listClaims(db, agentName);
  } finally {
    db.close();
  }
}
