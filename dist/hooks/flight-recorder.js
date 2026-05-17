"use strict";
/**
 * Nexus Framework - Flight Recorder
 * Captures all significant actions from agents and users.
 * Temporary knowledge that gets cleaned up after merge.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.record = record;
exports.getActive = getActive;
exports.getRecords = getRecords;
exports.cleanup = cleanup;
const db_1 = require("../db");
function record(event) {
    const db = (0, db_1.getDatabase)();
    try {
        const id = (0, db_1.recordFlight)(db, {
            actor_name: event.actor_name,
            session_id: event.session_id || process.env.NEXUS_SESSION_ID || process.pid.toString(),
            action: event.action,
            branch: event.branch,
            item_id: event.item_id,
            summary: event.summary,
            metadata: event.metadata ? JSON.stringify(event.metadata) : undefined,
        });
        (0, db_1.logAudit)(db, {
            actor_name: event.actor_name,
            session_id: event.session_id,
            action: `flight_record:${event.action}`,
            unit_key: event.branch,
            trigger_reason: event.summary,
            result: 'success',
        });
        return id;
    }
    finally {
        db.close();
    }
}
function getActive() {
    const db = (0, db_1.getDatabase)();
    try {
        return (0, db_1.getActiveWork)(db);
    }
    finally {
        db.close();
    }
}
function getRecords(options) {
    const db = (0, db_1.getDatabase)();
    try {
        return (0, db_1.getFlightRecords)(db, options);
    }
    finally {
        db.close();
    }
}
function cleanup(branch) {
    const db = (0, db_1.getDatabase)();
    try {
        const count = (0, db_1.cleanupFlightRecords)(db, branch);
        (0, db_1.logAudit)(db, {
            actor_name: 'nexus-system',
            action: 'flight_cleanup',
            unit_key: branch,
            trigger_reason: `Branch ${branch} merged, cleaning up ${count} records`,
            result: 'success',
        });
        return count;
    }
    finally {
        db.close();
    }
}
//# sourceMappingURL=flight-recorder.js.map