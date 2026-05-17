"use strict";
/**
 * Nexus Framework - CRUD Operations for all tables
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createADR = createADR;
exports.getADR = getADR;
exports.listADRs = listADRs;
exports.updateADRStatus = updateADRStatus;
exports.recordFlight = recordFlight;
exports.getFlightRecords = getFlightRecords;
exports.getActiveWork = getActiveWork;
exports.cleanupFlightRecords = cleanupFlightRecords;
exports.createBacklogItem = createBacklogItem;
exports.getBacklogItem = getBacklogItem;
exports.listBacklog = listBacklog;
exports.updateBacklogStatus = updateBacklogStatus;
exports.claimBacklogItem = claimBacklogItem;
exports.claimUnit = claimUnit;
exports.releaseUnit = releaseUnit;
exports.getUnitOwner = getUnitOwner;
exports.listClaims = listClaims;
exports.logAudit = logAudit;
exports.getAuditLog = getAuditLog;
function createADR(db, adr) {
    const stmt = db.prepare(`
    INSERT INTO adrs (id, title, status, context, decision, consequences, created_by)
    VALUES (@id, @title, @status, @context, @decision, @consequences, @created_by)
  `);
    stmt.run(adr);
    return getADR(db, adr.id);
}
function getADR(db, id) {
    return db.prepare('SELECT * FROM adrs WHERE id = ?').get(id);
}
function listADRs(db, status) {
    if (status) {
        return db.prepare('SELECT * FROM adrs WHERE status = ? ORDER BY created_at DESC').all(status);
    }
    return db.prepare('SELECT * FROM adrs ORDER BY created_at DESC').all();
}
function updateADRStatus(db, id, status, supersededBy) {
    if (supersededBy) {
        db.prepare('UPDATE adrs SET status = ?, superseded_by = ? WHERE id = ?').run(status, supersededBy, id);
    }
    else {
        db.prepare('UPDATE adrs SET status = ? WHERE id = ?').run(status, id);
    }
}
function recordFlight(db, record) {
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
    return result.lastInsertRowid;
}
function getFlightRecords(db, options) {
    let query = 'SELECT * FROM flight_recorder WHERE 1=1';
    const params = [];
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
    return db.prepare(query).all(...params);
}
function getActiveWork(db) {
    return db.prepare(`
    SELECT DISTINCT branch, actor_name, MAX(timestamp) as timestamp, 
           action, item_id, summary
    FROM flight_recorder 
    WHERE branch IS NOT NULL 
    AND branch NOT IN ('main', 'master', 'develop', 'dev')
    GROUP BY branch
    ORDER BY timestamp DESC
  `).all();
}
function cleanupFlightRecords(db, branch) {
    const result = db.prepare('DELETE FROM flight_recorder WHERE branch = ?').run(branch);
    return result.changes;
}
function createBacklogItem(db, item) {
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
    return getBacklogItem(db, item.item_id);
}
function getBacklogItem(db, itemId) {
    return db.prepare('SELECT * FROM backlog WHERE item_id = ?').get(itemId);
}
function listBacklog(db, status) {
    if (status) {
        return db.prepare('SELECT * FROM backlog WHERE status = ? ORDER BY priority, created_at').all(status);
    }
    return db.prepare('SELECT * FROM backlog ORDER BY priority, created_at').all();
}
function updateBacklogStatus(db, itemId, status) {
    db.prepare('UPDATE backlog SET status = ?, updated_at = datetime(\'now\') WHERE item_id = ?').run(status, itemId);
}
function claimBacklogItem(db, itemId, actorName) {
    db.prepare(`
    UPDATE backlog SET claimed_by = ?, claimed_at = datetime('now'), 
    status = 'IN_PROGRESS', updated_at = datetime('now') WHERE item_id = ?
  `).run(actorName, itemId);
}
function claimUnit(db, unitKey, agentName) {
    const existing = db.prepare('SELECT agent_name FROM unit_claims WHERE unit_key = ?').get(unitKey);
    if (existing) {
        if (existing.agent_name === agentName) {
            return { success: true, owner: agentName };
        }
        return { success: false, owner: existing.agent_name };
    }
    db.prepare('INSERT OR IGNORE INTO unit_claims (unit_key, agent_name) VALUES (?, ?)').run(unitKey, agentName);
    return { success: true, owner: agentName };
}
function releaseUnit(db, unitKey, agentName) {
    const result = db.prepare('DELETE FROM unit_claims WHERE unit_key = ? AND agent_name = ?').run(unitKey, agentName);
    return result.changes > 0;
}
function getUnitOwner(db, unitKey) {
    const row = db.prepare('SELECT agent_name FROM unit_claims WHERE unit_key = ?').get(unitKey);
    return row?.agent_name || null;
}
function listClaims(db, agentName) {
    if (agentName) {
        return db.prepare('SELECT * FROM unit_claims WHERE agent_name = ?').all(agentName);
    }
    return db.prepare('SELECT * FROM unit_claims ORDER BY claimed_at DESC').all();
}
function logAudit(db, entry) {
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
function getAuditLog(db, options) {
    let query = 'SELECT * FROM audit_log WHERE 1=1';
    const params = [];
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
    return db.prepare(query).all(...params);
}
//# sourceMappingURL=operations.js.map