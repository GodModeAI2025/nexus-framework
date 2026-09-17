/**
 * Nexus Framework - CRUD Operations for all tables
 */

import Database from 'better-sqlite3';
import { getDatabase } from './database';

// ============================================================
// ADR Operations
// ============================================================

export interface ADR {
  id: string;
  title: string;
  status: 'proposed' | 'accepted' | 'deprecated' | 'superseded';
  context?: string;
  decision?: string;
  consequences?: string;
  created_at?: string;
  created_by?: string;
  superseded_by?: string;
}

export function createADR(db: Database.Database, adr: Omit<ADR, 'created_at'>): ADR {
  const stmt = db.prepare(`
    INSERT INTO adrs (id, title, status, context, decision, consequences, created_by)
    VALUES (@id, @title, @status, @context, @decision, @consequences, @created_by)
  `);
  stmt.run(adr);
  return getADR(db, adr.id)!;
}

export function getADR(db: Database.Database, id: string): ADR | null {
  return db.prepare('SELECT * FROM adrs WHERE id = ?').get(id) as ADR | null;
}

export function listADRs(db: Database.Database, status?: string): ADR[] {
  if (status) {
    return db.prepare('SELECT * FROM adrs WHERE status = ? ORDER BY created_at DESC').all(status) as ADR[];
  }
  return db.prepare('SELECT * FROM adrs ORDER BY created_at DESC').all() as ADR[];
}

export function updateADRStatus(db: Database.Database, id: string, status: ADR['status'], supersededBy?: string): void {
  if (supersededBy) {
    db.prepare('UPDATE adrs SET status = ?, superseded_by = ? WHERE id = ?').run(status, supersededBy, id);
  } else {
    db.prepare('UPDATE adrs SET status = ? WHERE id = ?').run(status, id);
  }
}

// ============================================================
// Flight Recorder Operations
// ============================================================

export interface FlightRecord {
  id?: number;
  timestamp?: string;
  actor_name: string;
  session_id?: string;
  action: string;
  branch?: string;
  item_id?: string;
  summary?: string;
  metadata?: string;
}

export function recordFlight(db: Database.Database, record: FlightRecord): number {
  const stmt = db.prepare(`
    INSERT INTO flight_recorder (actor_name, session_id, action, branch, item_id, summary, metadata)
    VALUES (@actor_name, @session_id, @action, @branch, @item_id, @summary, @metadata)
  `);
  const result = stmt.run({
    actor_name: record.actor_name,
    session_id: record.session_id || null,
    action: record.action,
    branch: record.branch || null,
    item_id: record.item_id || null,
    summary: record.summary || null,
    metadata: record.metadata || null,
  });
  return result.lastInsertRowid as number;
}

export function getFlightRecords(db: Database.Database, options?: {
  branch?: string;
  actor_name?: string;
  action?: string;
  limit?: number;
}): FlightRecord[] {
  let query = 'SELECT * FROM flight_recorder WHERE 1=1';
  const params: any[] = [];

  if (options?.branch) {
    query += ' AND branch = ?';
    params.push(options.branch);
  }
  if (options?.actor_name) {
    query += ' AND actor_name = ?';
    params.push(options.actor_name);
  }
  if (options?.action) {
    query += ' AND action = ?';
    params.push(options.action);
  }
  query += ' ORDER BY timestamp DESC';
  if (options?.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }

  return db.prepare(query).all(...params) as FlightRecord[];
}

export function getActiveWork(db: Database.Database): FlightRecord[] {
  return db.prepare(`
    SELECT DISTINCT branch, actor_name, MAX(timestamp) as timestamp, 
           action, item_id, summary
    FROM flight_recorder 
    WHERE branch IS NOT NULL 
    AND branch NOT IN ('main', 'master', 'develop', 'dev')
    GROUP BY branch
    ORDER BY timestamp DESC
  `).all() as FlightRecord[];
}

export function cleanupFlightRecords(db: Database.Database, branch: string): number {
  const result = db.prepare('DELETE FROM flight_recorder WHERE branch = ?').run(branch);
  return result.changes;
}

// ============================================================
// Backlog Operations
// ============================================================

export interface BacklogItem {
  item_id: string;
  title: string;
  type: 'FEAT' | 'FIX' | 'IMP' | 'EPIC';
  status: 'NEW' | 'READY' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
  phase?: string;
  branch?: string;
  claimed_by?: string;
  claimed_at?: string;
  priority: 'P0' | 'P1' | 'P2';
  created_at?: string;
  updated_at?: string;
}

export function createBacklogItem(db: Database.Database, item: Omit<BacklogItem, 'created_at' | 'updated_at'>): BacklogItem {
  const stmt = db.prepare(`
    INSERT INTO backlog (item_id, title, type, status, phase, branch, claimed_by, claimed_at, priority)
    VALUES (@item_id, @title, @type, @status, @phase, @branch, @claimed_by, @claimed_at, @priority)
  `);
  stmt.run({
    item_id: item.item_id,
    title: item.title,
    type: item.type,
    status: item.status,
    phase: item.phase || null,
    branch: item.branch || null,
    claimed_by: item.claimed_by || null,
    claimed_at: item.claimed_at || null,
    priority: item.priority,
  });
  return getBacklogItem(db, item.item_id)!;
}

export function getBacklogItem(db: Database.Database, itemId: string): BacklogItem | null {
  return db.prepare('SELECT * FROM backlog WHERE item_id = ?').get(itemId) as BacklogItem | null;
}

export function listBacklog(db: Database.Database, status?: string): BacklogItem[] {
  if (status) {
    return db.prepare('SELECT * FROM backlog WHERE status = ? ORDER BY priority, created_at').all(status) as BacklogItem[];
  }
  return db.prepare('SELECT * FROM backlog ORDER BY priority, created_at').all() as BacklogItem[];
}

export function updateBacklogStatus(db: Database.Database, itemId: string, status: BacklogItem['status']): void {
  db.prepare('UPDATE backlog SET status = ?, updated_at = datetime(\'now\') WHERE item_id = ?').run(status, itemId);
}

export function claimBacklogItem(db: Database.Database, itemId: string, actorName: string): void {
  db.prepare(`
    UPDATE backlog SET claimed_by = ?, claimed_at = datetime('now'), 
    status = 'IN_PROGRESS', updated_at = datetime('now') WHERE item_id = ?
  `).run(actorName, itemId);
}

// ============================================================
// Unit Ownership Operations
// ============================================================

export interface UnitClaim {
  unit_key: string;
  agent_name: string;
  claimed_at?: string;
  expires_at?: string | null;
}

/** SQL-Bedingung für Claims, deren Lease noch läuft (oder die keinen Ablauf haben). */
const ACTIVE_CLAIM = "(expires_at IS NULL OR expires_at > datetime('now'))";

function leaseModifier(ttlSeconds?: number): string | null {
  if (ttlSeconds === undefined || ttlSeconds === null) return null;
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
    throw new Error(`Invalid lease TTL: ${ttlSeconds} (expected a positive integer of seconds)`);
  }
  return `+${ttlSeconds} seconds`;
}

/**
 * Atomarer Claim (first-writer-wins) mit optionalem Lease.
 * Läuft in einer IMMEDIATE-Transaktion: abgelaufene Claims auf derselben Unit werden
 * zuerst entfernt, danach entscheidet INSERT OR IGNORE, wer gewinnt.
 * Claimt der bisherige Owner erneut, wird sein Lease verlängert.
 */
export function claimUnit(
  db: Database.Database,
  unitKey: string,
  agentName: string,
  ttlSeconds?: number,
): { success: boolean; owner?: string; expires_at?: string | null; expiredOwner?: string } {
  const modifier = leaseModifier(ttlSeconds);
  const run = db.transaction(() => {
    const expired = db.prepare(
      "SELECT agent_name FROM unit_claims WHERE unit_key = ? AND expires_at IS NOT NULL AND expires_at <= datetime('now')"
    ).get(unitKey) as { agent_name: string } | undefined;
    if (expired) {
      db.prepare('DELETE FROM unit_claims WHERE unit_key = ?').run(unitKey);
    }

    const inserted = db.prepare(`
      INSERT OR IGNORE INTO unit_claims (unit_key, agent_name, expires_at)
      VALUES (?, ?, CASE WHEN ? IS NULL THEN NULL ELSE datetime('now', ?) END)
    `).run(unitKey, agentName, modifier, modifier);

    if (inserted.changes === 0) {
      const existing = db.prepare('SELECT agent_name FROM unit_claims WHERE unit_key = ?').get(unitKey) as { agent_name: string };
      if (existing.agent_name !== agentName) {
        return { success: false, owner: existing.agent_name };
      }
      if (modifier) {
        db.prepare("UPDATE unit_claims SET expires_at = datetime('now', ?) WHERE unit_key = ?").run(modifier, unitKey);
      }
    }

    const row = db.prepare('SELECT expires_at FROM unit_claims WHERE unit_key = ?').get(unitKey) as { expires_at: string | null };
    return { success: true, owner: agentName, expires_at: row.expires_at, expiredOwner: expired?.agent_name };
  });
  return run.immediate();
}

/** Verlängert den Lease eines aktiven Claims (Heartbeat). Nur der Owner darf verlängern. */
export function renewUnit(db: Database.Database, unitKey: string, agentName: string, ttlSeconds: number): string | null {
  const modifier = leaseModifier(ttlSeconds)!;
  const result = db.prepare(`
    UPDATE unit_claims SET expires_at = datetime('now', ?)
    WHERE unit_key = ? AND agent_name = ? AND ${ACTIVE_CLAIM}
  `).run(modifier, unitKey, agentName);
  if (result.changes === 0) return null;
  const row = db.prepare('SELECT expires_at FROM unit_claims WHERE unit_key = ?').get(unitKey) as { expires_at: string };
  return row.expires_at;
}

export function releaseUnit(db: Database.Database, unitKey: string, agentName: string): boolean {
  const result = db.prepare('DELETE FROM unit_claims WHERE unit_key = ? AND agent_name = ?').run(unitKey, agentName);
  return result.changes > 0;
}

export function getUnitOwner(db: Database.Database, unitKey: string): string | null {
  const row = db.prepare(`SELECT agent_name FROM unit_claims WHERE unit_key = ? AND ${ACTIVE_CLAIM}`).get(unitKey) as { agent_name: string } | undefined;
  return row?.agent_name || null;
}

export function listClaims(db: Database.Database, agentName?: string): UnitClaim[] {
  if (agentName) {
    return db.prepare(`SELECT * FROM unit_claims WHERE agent_name = ? AND ${ACTIVE_CLAIM}`).all(agentName) as UnitClaim[];
  }
  return db.prepare(`SELECT * FROM unit_claims WHERE ${ACTIVE_CLAIM} ORDER BY claimed_at DESC`).all() as UnitClaim[];
}

/** Entfernt alle abgelaufenen Claims und gibt sie zurück (z. B. für das Audit Log). */
export function purgeExpiredClaims(db: Database.Database): UnitClaim[] {
  const purge = db.transaction(() => {
    const expired = db.prepare(`SELECT * FROM unit_claims WHERE NOT ${ACTIVE_CLAIM}`).all() as UnitClaim[];
    db.prepare(`DELETE FROM unit_claims WHERE NOT ${ACTIVE_CLAIM}`).run();
    return expired;
  });
  return purge.immediate();
}

// ============================================================
// Audit Log Operations
// ============================================================

export interface AuditEntry {
  id?: number;
  timestamp?: string;
  actor_name?: string;
  session_id?: string;
  action: string;
  unit_key?: string;
  trigger_reason?: string;
  result: 'success' | 'error' | 'blocked';
  error_message?: string;
}

export function logAudit(db: Database.Database, entry: AuditEntry): void {
  db.prepare(`
    INSERT INTO audit_log (actor_name, session_id, action, unit_key, trigger_reason, result, error_message)
    VALUES (@actor_name, @session_id, @action, @unit_key, @trigger_reason, @result, @error_message)
  `).run({
    actor_name: entry.actor_name || null,
    session_id: entry.session_id || null,
    action: entry.action,
    unit_key: entry.unit_key || null,
    trigger_reason: entry.trigger_reason || null,
    result: entry.result,
    error_message: entry.error_message || null,
  });
}

export function getAuditLog(db: Database.Database, options?: {
  actor_name?: string;
  action?: string;
  result?: string;
  limit?: number;
}): AuditEntry[] {
  let query = 'SELECT * FROM audit_log WHERE 1=1';
  const params: any[] = [];

  if (options?.actor_name) {
    query += ' AND actor_name = ?';
    params.push(options.actor_name);
  }
  if (options?.action) {
    query += ' AND action = ?';
    params.push(options.action);
  }
  if (options?.result) {
    query += ' AND result = ?';
    params.push(options.result);
  }
  query += ' ORDER BY timestamp DESC';
  if (options?.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }

  return db.prepare(query).all(...params) as AuditEntry[];
}
