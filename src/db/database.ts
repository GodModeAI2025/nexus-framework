/**
 * Nexus Framework - Database Connection & Initialization
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { SCHEMA_SQL, COLUMN_MIGRATIONS } from './schema';

const NEXUS_DIR = '.nexus';
const DB_FILE = 'nexus.db';

export function getNexusDir(projectRoot?: string): string {
  const root = projectRoot || findProjectRoot();
  return path.join(root, NEXUS_DIR);
}

export function findProjectRoot(): string {
  let dir = process.cwd();
  while (dir !== '/') {
    if (fs.existsSync(path.join(dir, NEXUS_DIR))) {
      return dir;
    }
    if (fs.existsSync(path.join(dir, '.git'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

export function getDatabase(projectRoot?: string): Database.Database {
  const nexusDir = getNexusDir(projectRoot);
  if (!fs.existsSync(nexusDir)) {
    fs.mkdirSync(nexusDir, { recursive: true });
  }
  const dbPath = path.join(nexusDir, DB_FILE);
  const db = new Database(dbPath);
  // Mehrere Agenten/Hooks greifen parallel zu: kurz auf Locks warten statt sofort SQLITE_BUSY
  db.pragma('busy_timeout = 5000');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  applyColumnMigrations(db);
  return db;
}

export function applyColumnMigrations(db: Database.Database): void {
  for (const m of COLUMN_MIGRATIONS) {
    const columns = db.prepare(`PRAGMA table_info(${m.table})`).all() as Array<{ name: string }>;
    if (!columns.some(c => c.name === m.column)) {
      db.exec(m.ddl);
    }
  }
}

export function initNexus(projectRoot?: string): string {
  const root = projectRoot || process.cwd();
  const nexusDir = path.join(root, NEXUS_DIR);
  if (!fs.existsSync(nexusDir)) {
    fs.mkdirSync(nexusDir, { recursive: true });
  }
  const db = getDatabase(root);
  db.close();
  return nexusDir;
}
