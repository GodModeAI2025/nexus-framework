"use strict";
/**
 * Nexus Framework - Unit Ownership Tests
 * Run: pnpm build && pnpm test
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = __importDefault(require("node:assert/strict"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const schema_1 = require("../db/schema");
const database_1 = require("../db/database");
const operations_1 = require("../db/operations");
function freshDb() {
    const db = new better_sqlite3_1.default(':memory:');
    db.exec(schema_1.SCHEMA_SQL);
    (0, database_1.applyColumnMigrations)(db);
    return db;
}
function expire(db, unitKey) {
    db.prepare("UPDATE unit_claims SET expires_at = datetime('now', '-1 seconds') WHERE unit_key = ?").run(unitKey);
}
(0, node_test_1.test)('first writer wins, second agent is blocked', () => {
    const db = freshDb();
    strict_1.default.equal((0, operations_1.claimUnit)(db, 'src/auth', 'Claude').success, true);
    const second = (0, operations_1.claimUnit)(db, 'src/auth', 'Codex');
    strict_1.default.equal(second.success, false);
    strict_1.default.equal(second.owner, 'Claude');
    strict_1.default.equal((0, operations_1.getUnitOwner)(db, 'src/auth'), 'Claude');
});
(0, node_test_1.test)('claim without TTL never expires', () => {
    const db = freshDb();
    const result = (0, operations_1.claimUnit)(db, 'src/auth', 'Claude');
    strict_1.default.equal(result.expires_at, null);
    strict_1.default.equal((0, operations_1.purgeExpiredClaims)(db).length, 0);
});
(0, node_test_1.test)('expired lease no longer blocks and can be taken over', () => {
    const db = freshDb();
    (0, operations_1.claimUnit)(db, 'src/payments', 'Claude', 60);
    expire(db, 'src/payments');
    strict_1.default.equal((0, operations_1.getUnitOwner)(db, 'src/payments'), null);
    strict_1.default.equal((0, operations_1.listClaims)(db).length, 0);
    const takeover = (0, operations_1.claimUnit)(db, 'src/payments', 'Codex', 60);
    strict_1.default.equal(takeover.success, true);
    strict_1.default.equal(takeover.expiredOwner, 'Claude');
    strict_1.default.equal((0, operations_1.getUnitOwner)(db, 'src/payments'), 'Codex');
});
(0, node_test_1.test)('re-claim by owner extends the lease', () => {
    const db = freshDb();
    const first = (0, operations_1.claimUnit)(db, 'src/ui', 'Claude', 60);
    const again = (0, operations_1.claimUnit)(db, 'src/ui', 'Claude', 3600);
    strict_1.default.equal(again.success, true);
    strict_1.default.ok(again.expires_at > first.expires_at);
});
(0, node_test_1.test)('renew only works for the active owner', () => {
    const db = freshDb();
    (0, operations_1.claimUnit)(db, 'src/db', 'Claude', 60);
    strict_1.default.ok((0, operations_1.renewUnit)(db, 'src/db', 'Claude', 600));
    strict_1.default.equal((0, operations_1.renewUnit)(db, 'src/db', 'Codex', 600), null);
    expire(db, 'src/db');
    strict_1.default.equal((0, operations_1.renewUnit)(db, 'src/db', 'Claude', 600), null, 'expired lease must be re-claimed, not renewed');
});
(0, node_test_1.test)('purgeExpiredClaims removes only expired claims', () => {
    const db = freshDb();
    (0, operations_1.claimUnit)(db, 'a', 'Claude', 60);
    (0, operations_1.claimUnit)(db, 'b', 'Codex', 60);
    (0, operations_1.claimUnit)(db, 'c', 'Human');
    expire(db, 'a');
    const purged = (0, operations_1.purgeExpiredClaims)(db);
    strict_1.default.deepEqual(purged.map(c => c.unit_key), ['a']);
    strict_1.default.deepEqual((0, operations_1.listClaims)(db).map(c => c.unit_key).sort(), ['b', 'c']);
});
(0, node_test_1.test)('invalid TTL is rejected', () => {
    const db = freshDb();
    strict_1.default.throws(() => (0, operations_1.claimUnit)(db, 'x', 'Claude', 0));
    strict_1.default.throws(() => (0, operations_1.claimUnit)(db, 'x', 'Claude', 1.5));
});
(0, node_test_1.test)('release only by owner', () => {
    const db = freshDb();
    (0, operations_1.claimUnit)(db, 'src/auth', 'Claude', 60);
    strict_1.default.equal((0, operations_1.releaseUnit)(db, 'src/auth', 'Codex'), false);
    strict_1.default.equal((0, operations_1.releaseUnit)(db, 'src/auth', 'Claude'), true);
});
(0, node_test_1.test)('migration adds expires_at to databases created before leases existed', () => {
    const db = new better_sqlite3_1.default(':memory:');
    db.exec(`CREATE TABLE unit_claims (
    unit_key TEXT PRIMARY KEY,
    agent_name TEXT NOT NULL,
    claimed_at TEXT DEFAULT (datetime('now'))
  )`);
    db.prepare('INSERT INTO unit_claims (unit_key, agent_name) VALUES (?, ?)').run('legacy', 'Claude');
    db.exec(schema_1.SCHEMA_SQL);
    (0, database_1.applyColumnMigrations)(db);
    (0, database_1.applyColumnMigrations)(db); // idempotent
    strict_1.default.equal((0, operations_1.getUnitOwner)(db, 'legacy'), 'Claude');
    strict_1.default.equal((0, operations_1.claimUnit)(db, 'new', 'Codex', 60).success, true);
});
//# sourceMappingURL=ownership.test.js.map