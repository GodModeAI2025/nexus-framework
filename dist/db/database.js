"use strict";
/**
 * Nexus Framework - Database Connection & Initialization
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNexusDir = getNexusDir;
exports.findProjectRoot = findProjectRoot;
exports.getDatabase = getDatabase;
exports.applyColumnMigrations = applyColumnMigrations;
exports.initNexus = initNexus;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const schema_1 = require("./schema");
const NEXUS_DIR = '.nexus';
const DB_FILE = 'nexus.db';
function getNexusDir(projectRoot) {
    const root = projectRoot || findProjectRoot();
    return path.join(root, NEXUS_DIR);
}
function findProjectRoot() {
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
function getDatabase(projectRoot) {
    const nexusDir = getNexusDir(projectRoot);
    if (!fs.existsSync(nexusDir)) {
        fs.mkdirSync(nexusDir, { recursive: true });
    }
    const dbPath = path.join(nexusDir, DB_FILE);
    const db = new better_sqlite3_1.default(dbPath);
    // Mehrere Agenten/Hooks greifen parallel zu: kurz auf Locks warten statt sofort SQLITE_BUSY
    db.pragma('busy_timeout = 5000');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(schema_1.SCHEMA_SQL);
    applyColumnMigrations(db);
    return db;
}
function hasColumn(db, table, column) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    return columns.some(c => c.name === column);
}
function applyColumnMigrations(db) {
    const pending = schema_1.COLUMN_MIGRATIONS.filter(m => !hasColumn(db, m.table, m.column));
    if (pending.length === 0)
        return;
    // Mehrere Prozesse können eine Alt-DB gleichzeitig öffnen: unter Schreibsperre erneut prüfen,
    // sonst scheitert der zweite ALTER TABLE mit "duplicate column name".
    const migrate = db.transaction(() => {
        for (const m of pending) {
            if (!hasColumn(db, m.table, m.column))
                db.exec(m.ddl);
        }
    });
    migrate.immediate();
}
function initNexus(projectRoot) {
    const root = projectRoot || process.cwd();
    const nexusDir = path.join(root, NEXUS_DIR);
    if (!fs.existsSync(nexusDir)) {
        fs.mkdirSync(nexusDir, { recursive: true });
    }
    const db = getDatabase(root);
    db.close();
    return nexusDir;
}
//# sourceMappingURL=database.js.map