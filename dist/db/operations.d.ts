/**
 * Nexus Framework - CRUD Operations for all tables
 */
import Database from 'better-sqlite3';
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
export declare function createADR(db: Database.Database, adr: Omit<ADR, 'created_at'>): ADR;
export declare function getADR(db: Database.Database, id: string): ADR | null;
export declare function listADRs(db: Database.Database, status?: string): ADR[];
export declare function updateADRStatus(db: Database.Database, id: string, status: ADR['status'], supersededBy?: string): void;
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
export declare function recordFlight(db: Database.Database, record: FlightRecord): number;
export declare function getFlightRecords(db: Database.Database, options?: {
    branch?: string;
    actor_name?: string;
    action?: string;
    limit?: number;
}): FlightRecord[];
export declare function getActiveWork(db: Database.Database): FlightRecord[];
export declare function cleanupFlightRecords(db: Database.Database, branch: string): number;
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
export declare function createBacklogItem(db: Database.Database, item: Omit<BacklogItem, 'created_at' | 'updated_at'>): BacklogItem;
export declare function getBacklogItem(db: Database.Database, itemId: string): BacklogItem | null;
export declare function listBacklog(db: Database.Database, status?: string): BacklogItem[];
export declare function updateBacklogStatus(db: Database.Database, itemId: string, status: BacklogItem['status']): void;
export declare function claimBacklogItem(db: Database.Database, itemId: string, actorName: string): void;
export interface UnitClaim {
    unit_key: string;
    agent_name: string;
    claimed_at?: string;
    expires_at?: string | null;
}
/**
 * Atomarer Claim (first-writer-wins) mit optionalem Lease.
 * Läuft in einer IMMEDIATE-Transaktion: abgelaufene Claims auf derselben Unit werden
 * zuerst entfernt, danach entscheidet INSERT OR IGNORE, wer gewinnt.
 * Claimt der bisherige Owner erneut, wird sein Lease verlängert.
 */
export declare function claimUnit(db: Database.Database, unitKey: string, agentName: string, ttlSeconds?: number): {
    success: boolean;
    owner?: string;
    expires_at?: string | null;
    expiredOwner?: string;
};
/** Verlängert den Lease eines aktiven Claims (Heartbeat). Nur der Owner darf verlängern. */
export declare function renewUnit(db: Database.Database, unitKey: string, agentName: string, ttlSeconds: number): string | null;
export declare function releaseUnit(db: Database.Database, unitKey: string, agentName: string): boolean;
export declare function getUnitOwner(db: Database.Database, unitKey: string): string | null;
export declare function listClaims(db: Database.Database, agentName?: string): UnitClaim[];
/** Entfernt alle abgelaufenen Claims und gibt sie zurück (z. B. für das Audit Log). */
export declare function purgeExpiredClaims(db: Database.Database): UnitClaim[];
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
export declare function logAudit(db: Database.Database, entry: AuditEntry): void;
export declare function getAuditLog(db: Database.Database, options?: {
    actor_name?: string;
    action?: string;
    result?: string;
    limit?: number;
}): AuditEntry[];
//# sourceMappingURL=operations.d.ts.map