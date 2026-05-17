/**
 * Nexus Framework - Database Connection & Initialization
 */
import Database from 'better-sqlite3';
export declare function getNexusDir(projectRoot?: string): string;
export declare function findProjectRoot(): string;
export declare function getDatabase(projectRoot?: string): Database.Database;
export declare function initNexus(projectRoot?: string): string;
//# sourceMappingURL=database.d.ts.map