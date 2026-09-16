/**
 * Nexus Framework - Unit Ownership Tests
 * Run: pnpm build && pnpm test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { SCHEMA_SQL } from '../db/schema';
import { applyColumnMigrations } from '../db/database';
import { claimUnit, renewUnit, releaseUnit, getUnitOwner, listClaims, purgeExpiredClaims } from '../db/operations';

function freshDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(SCHEMA_SQL);
  applyColumnMigrations(db);
  return db;
}

function expire(db: Database.Database, unitKey: string): void {
  db.prepare("UPDATE unit_claims SET expires_at = datetime('now', '-1 seconds') WHERE unit_key = ?").run(unitKey);
}

test('first writer wins, second agent is blocked', () => {
  const db = freshDb();
  assert.equal(claimUnit(db, 'src/auth', 'Claude').success, true);
  const second = claimUnit(db, 'src/auth', 'Codex');
  assert.equal(second.success, false);
  assert.equal(second.owner, 'Claude');
  assert.equal(getUnitOwner(db, 'src/auth'), 'Claude');
});

test('claim without TTL never expires', () => {
  const db = freshDb();
  const result = claimUnit(db, 'src/auth', 'Claude');
  assert.equal(result.expires_at, null);
  assert.equal(purgeExpiredClaims(db).length, 0);
});

test('expired lease no longer blocks and can be taken over', () => {
  const db = freshDb();
  claimUnit(db, 'src/payments', 'Claude', 60);
  expire(db, 'src/payments');

  assert.equal(getUnitOwner(db, 'src/payments'), null);
  assert.equal(listClaims(db).length, 0);

  const takeover = claimUnit(db, 'src/payments', 'Codex', 60);
  assert.equal(takeover.success, true);
  assert.equal(takeover.expiredOwner, 'Claude');
  assert.equal(getUnitOwner(db, 'src/payments'), 'Codex');
});

test('re-claim by owner extends the lease', () => {
  const db = freshDb();
  const first = claimUnit(db, 'src/ui', 'Claude', 60);
  const again = claimUnit(db, 'src/ui', 'Claude', 3600);
  assert.equal(again.success, true);
  assert.ok(again.expires_at! > first.expires_at!);
});

test('renew only works for the active owner', () => {
  const db = freshDb();
  claimUnit(db, 'src/db', 'Claude', 60);
  assert.ok(renewUnit(db, 'src/db', 'Claude', 600));
  assert.equal(renewUnit(db, 'src/db', 'Codex', 600), null);

  expire(db, 'src/db');
  assert.equal(renewUnit(db, 'src/db', 'Claude', 600), null, 'expired lease must be re-claimed, not renewed');
});

test('purgeExpiredClaims removes only expired claims', () => {
  const db = freshDb();
  claimUnit(db, 'a', 'Claude', 60);
  claimUnit(db, 'b', 'Codex', 60);
  claimUnit(db, 'c', 'Human');
  expire(db, 'a');

  const purged = purgeExpiredClaims(db);
  assert.deepEqual(purged.map(c => c.unit_key), ['a']);
  assert.deepEqual(listClaims(db).map(c => c.unit_key).sort(), ['b', 'c']);
});

test('invalid TTL is rejected', () => {
  const db = freshDb();
  assert.throws(() => claimUnit(db, 'x', 'Claude', 0));
  assert.throws(() => claimUnit(db, 'x', 'Claude', 1.5));
});

test('release only by owner', () => {
  const db = freshDb();
  claimUnit(db, 'src/auth', 'Claude', 60);
  assert.equal(releaseUnit(db, 'src/auth', 'Codex'), false);
  assert.equal(releaseUnit(db, 'src/auth', 'Claude'), true);
});

test('migration adds expires_at to databases created before leases existed', () => {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE unit_claims (
    unit_key TEXT PRIMARY KEY,
    agent_name TEXT NOT NULL,
    claimed_at TEXT DEFAULT (datetime('now'))
  )`);
  db.prepare('INSERT INTO unit_claims (unit_key, agent_name) VALUES (?, ?)').run('legacy', 'Claude');
  db.exec(SCHEMA_SQL);
  applyColumnMigrations(db);
  applyColumnMigrations(db); // idempotent

  assert.equal(getUnitOwner(db, 'legacy'), 'Claude');
  assert.equal(claimUnit(db, 'new', 'Codex', 60).success, true);
});
