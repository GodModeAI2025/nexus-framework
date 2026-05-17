/**
 * Nexus Framework - Flight Recorder
 * Captures all significant actions from agents and users.
 * Temporary knowledge that gets cleaned up after merge.
 */
import { getFlightRecords, getActiveWork } from '../db';
export interface FlightEvent {
    actor_name: string;
    session_id?: string;
    action: string;
    branch?: string;
    item_id?: string;
    summary?: string;
    metadata?: Record<string, unknown>;
}
export declare function record(event: FlightEvent): number;
export declare function getActive(): ReturnType<typeof getActiveWork>;
export declare function getRecords(options?: Parameters<typeof getFlightRecords>[1]): import("../db").FlightRecord[];
export declare function cleanup(branch: string): number;
//# sourceMappingURL=flight-recorder.d.ts.map