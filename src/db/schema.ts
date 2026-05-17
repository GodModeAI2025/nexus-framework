/**
 * Nexus Framework - Database Schema
 * Central Project Memory: ADRs, Flight Recorder, Backlog, Unit Claims, Audit Log
 */

export const SCHEMA_SQL = `
-- Permanentes Wissen: Architecture Decision Records
CREATE TABLE IF NOT EXISTS adrs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT CHECK(status IN ('proposed','accepted','deprecated','superseded')) DEFAULT 'proposed',
    context TEXT,
    decision TEXT,
    consequences TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    created_by TEXT,
    superseded_by TEXT REFERENCES adrs(id)
);

-- Temporäres Wissen: Flugrekorder (wird nach Merge gelöscht)
CREATE TABLE IF NOT EXISTS flight_recorder (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT (datetime('now')),
    actor_name TEXT NOT NULL,
    session_id TEXT,
    action TEXT NOT NULL,
    branch TEXT,
    item_id TEXT,
    summary TEXT,
    metadata TEXT
);

-- Backlog: Single Source of Truth
CREATE TABLE IF NOT EXISTS backlog (
    item_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT CHECK(type IN ('FEAT','FIX','IMP','EPIC')),
    status TEXT CHECK(status IN ('NEW','READY','IN_PROGRESS','IN_REVIEW','DONE')) DEFAULT 'NEW',
    phase TEXT,
    branch TEXT,
    claimed_by TEXT,
    claimed_at TEXT,
    priority TEXT CHECK(priority IN ('P0','P1','P2')) DEFAULT 'P1',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Unit Ownership: Single-Writer Engine
CREATE TABLE IF NOT EXISTS unit_claims (
    unit_key TEXT PRIMARY KEY,
    agent_name TEXT NOT NULL,
    claimed_at TEXT DEFAULT (datetime('now'))
);

-- Audit Log: Wer hat was getan und warum
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT (datetime('now')),
    actor_name TEXT,
    session_id TEXT,
    action TEXT NOT NULL,
    unit_key TEXT,
    trigger_reason TEXT,
    result TEXT CHECK(result IN ('success','error','blocked')),
    error_message TEXT
);

-- Indices für Performance
CREATE INDEX IF NOT EXISTS idx_flight_recorder_branch ON flight_recorder(branch);
CREATE INDEX IF NOT EXISTS idx_flight_recorder_actor ON flight_recorder(actor_name);
CREATE INDEX IF NOT EXISTS idx_flight_recorder_action ON flight_recorder(action);
CREATE INDEX IF NOT EXISTS idx_backlog_status ON backlog(status);
CREATE INDEX IF NOT EXISTS idx_backlog_branch ON backlog(branch);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
`;
