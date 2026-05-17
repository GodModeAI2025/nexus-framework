/**
 * Nexus Framework - Flight Recorder
 * Captures all significant actions from agents and users.
 * Temporary knowledge that gets cleaned up after merge.
 */

import { getDatabase, recordFlight, getFlightRecords, getActiveWork, cleanupFlightRecords, logAudit } from '../db';

export interface FlightEvent {
  actor_name: string;
  session_id?: string;
  action: string;
  branch?: string;
  item_id?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}

export function record(event: FlightEvent): number {
  const db = getDatabase();
  try {
    const id = recordFlight(db, {
      actor_name: event.actor_name,
      session_id: event.session_id || process.env.NEXUS_SESSION_ID || process.pid.toString(),
      action: event.action,
      branch: event.branch,
      item_id: event.item_id,
      summary: event.summary,
      metadata: event.metadata ? JSON.stringify(event.metadata) : undefined,
    });

    logAudit(db, {
      actor_name: event.actor_name,
      session_id: event.session_id,
      action: `flight_record:${event.action}`,
      unit_key: event.branch,
      trigger_reason: event.summary,
      result: 'success',
    });

    return id;
  } finally {
    db.close();
  }
}

export function getActive(): ReturnType<typeof getActiveWork> {
  const db = getDatabase();
  try {
    return getActiveWork(db);
  } finally {
    db.close();
  }
}

export function getRecords(options?: Parameters<typeof getFlightRecords>[1]) {
  const db = getDatabase();
  try {
    return getFlightRecords(db, options);
  } finally {
    db.close();
  }
}

export function cleanup(branch: string): number {
  const db = getDatabase();
  try {
    const count = cleanupFlightRecords(db, branch);
    logAudit(db, {
      actor_name: 'nexus-system',
      action: 'flight_cleanup',
      unit_key: branch,
      trigger_reason: `Branch ${branch} merged, cleaning up ${count} records`,
      result: 'success',
    });
    return count;
  } finally {
    db.close();
  }
}
