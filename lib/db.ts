import * as SQLite from 'expo-sqlite';

export type CaptureRow = {
  id: number;
  itemId: string; // slug of item
  title: string; // item title denormalized for convenience
  originalUri: string; // file:// uri to original image
  thumbnailUri: string; // file:// uri to 1:1 ~1024px jpeg
  createdAt: number; // epoch ms - when added to app
  photoTakenAt: number; // epoch ms - when photo was originally taken (from EXIF)
  latitude?: number | null;
  longitude?: number | null;
};

export type BonusEventRow = {
  id: number;
  captureId: number; // FK to captures.id
  biomeId: string;
  biomeLabel: string;
  multiplier: number; // applied multiplier (e.g., 1.5)
  bonusPoints: number; // computed extra points (not base)
  createdAt: number; // epoch ms
};

let db: SQLite.SQLiteDatabase | null = null;

// Simple in-memory event listeners for capture changes
export type CapturesListener = () => void;
const captureListeners = new Set<CapturesListener>();

function emitCapturesChanged() {
  captureListeners.forEach((listener) => {
    try {
      listener();
    } catch {}
  });
}

export function addCapturesListener(listener: CapturesListener): () => void {
  captureListeners.add(listener);
  return () => captureListeners.delete(listener);
}

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('app.db');
    initialize(db);
  }
  return db;
}

function initialize(database: SQLite.SQLiteDatabase) {
  // Ensure FK constraints are enforced so bonus rows cascade on capture deletes
  try {
    database.execSync('PRAGMA foreign_keys = ON;');
  } catch {}

  database.execSync(
    `CREATE TABLE IF NOT EXISTS captures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      itemId TEXT NOT NULL,
      title TEXT NOT NULL,
      originalUri TEXT NOT NULL,
      thumbnailUri TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      photoTakenAt INTEGER NOT NULL,
      latitude REAL,
      longitude REAL
    );`
  );

  // Migration: Add photoTakenAt column if it doesn't exist
  try {
    database.execSync(`ALTER TABLE captures ADD COLUMN photoTakenAt INTEGER;`);
    // For existing records, set photoTakenAt to createdAt (fallback)
    database.execSync(`UPDATE captures SET photoTakenAt = createdAt WHERE photoTakenAt IS NULL;`);
  } catch (e) {
    // Column already exists, ignore error
  }

  database.execSync(
    `CREATE INDEX IF NOT EXISTS idx_captures_item ON captures(itemId);`
  );
  database.execSync(
    `CREATE INDEX IF NOT EXISTS idx_captures_createdAt ON captures(createdAt);`
  );
  database.execSync(
    `CREATE INDEX IF NOT EXISTS idx_captures_photoTakenAt ON captures(photoTakenAt);`
  );

  // Bonuses table stores additional points awarded by biome multipliers per capture
  database.execSync(
    `CREATE TABLE IF NOT EXISTS bonuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      captureId INTEGER NOT NULL,
      biomeId TEXT NOT NULL,
      biomeLabel TEXT NOT NULL,
      multiplier REAL NOT NULL,
      bonusPoints INTEGER NOT NULL,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY(captureId) REFERENCES captures(id) ON DELETE CASCADE
    );`
  );
  database.execSync(
    `CREATE INDEX IF NOT EXISTS idx_bonuses_captureId ON bonuses(captureId);`
  );

  // Key-Value settings table for app flags (e.g., onboarding)
  database.execSync(
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT
    );`
  );
}

export function insertCapture(row: Omit<CaptureRow, 'id'>): number {
  const database = getDb();
  const result = database.runSync(
    `INSERT INTO captures (itemId, title, originalUri, thumbnailUri, createdAt, photoTakenAt, latitude, longitude)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      row.itemId,
      row.title,
      row.originalUri,
      row.thumbnailUri,
      row.createdAt,
      row.photoTakenAt,
      row.latitude ?? null,
      row.longitude ?? null,
    ]
  );
  const id = result.lastInsertRowId ?? 0;
  emitCapturesChanged();
  return id;
}

export function deleteCapture(id: number) {
  const database = getDb();
  database.runSync(`DELETE FROM captures WHERE id = ?;`, [id]);
  emitCapturesChanged();
}

export function updateCaptureLocation(id: number, latitude: number | null, longitude: number | null) {
  const database = getDb();
  database.runSync(
    `UPDATE captures SET latitude = ?, longitude = ? WHERE id = ?;`,
    [latitude ?? null, longitude ?? null, id]
  );
  emitCapturesChanged();
}

export function getLatestCaptureForItem(itemId: string): CaptureRow | null {
  const database = getDb();
  const rows = database.getAllSync<CaptureRow>(
    `SELECT * FROM captures WHERE itemId = ? ORDER BY createdAt DESC LIMIT 1;`,
    [itemId]
  );
  return rows[0] ?? null;
}

export type CaptureFilters = {
  itemId?: string;
  startDateMs?: number;
  endDateMs?: number;
};

export function listCaptures(filters: CaptureFilters = {}): CaptureRow[] {
  const database = getDb();
  const clauses: string[] = [];
  const params: any[] = [];

  if (filters.itemId) {
    clauses.push('itemId = ?');
    params.push(filters.itemId);
  }
  if (filters.startDateMs) {
    clauses.push('createdAt >= ?');
    params.push(filters.startDateMs);
  }
  if (filters.endDateMs) {
    clauses.push('createdAt <= ?');
    params.push(filters.endDateMs);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const sql = `SELECT * FROM captures ${where} ORDER BY createdAt DESC;`;
  return database.getAllSync<CaptureRow>(sql, params);
}

export function listDistinctCapturedItemIds(): string[] {
  const database = getDb();
  const rows = database.getAllSync<{ itemId: string }>(
    `SELECT DISTINCT itemId FROM captures;`
  );
  return rows.map((r) => r.itemId);
}

export function insertBonusEvent(row: Omit<BonusEventRow, 'id'>): number {
  const database = getDb();
  const result = database.runSync(
    `INSERT INTO bonuses (captureId, biomeId, biomeLabel, multiplier, bonusPoints, createdAt)
     VALUES (?, ?, ?, ?, ?, ?);`,
    [
      row.captureId,
      row.biomeId,
      row.biomeLabel,
      row.multiplier,
      row.bonusPoints,
      row.createdAt,
    ]
  );
  const id = result.lastInsertRowId ?? 0;
  emitCapturesChanged();
  return id;
}

export function listBonusEventsForCapture(captureId: number): BonusEventRow[] {
  const database = getDb();
  return database.getAllSync<BonusEventRow>(
    `SELECT * FROM bonuses WHERE captureId = ? ORDER BY createdAt ASC;`,
    [captureId]
  );
}

export function listAllBonuses(): BonusEventRow[] {
  const database = getDb();
  return database.getAllSync<BonusEventRow>(
    `SELECT * FROM bonuses ORDER BY createdAt DESC;`,
    []
  );
}

// --- Settings helpers ---
export function setSetting(key: string, value: string | null) {
  const database = getDb();
  if (value === null) {
    database.runSync(`DELETE FROM settings WHERE key = ?;`, [key]);
    return;
  }
  database.runSync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
    [key, value]
  );
}

export function getSetting(key: string): string | null {
  const database = getDb();
  const row = database.getFirstSync<{ value: string }>(
    `SELECT value FROM settings WHERE key = ? LIMIT 1;`,
    [key]
  );
  return row?.value ?? null;
}

export const ONBOARDED_KEY = 'has_onboarded_v1';

