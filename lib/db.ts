import * as SQLite from 'expo-sqlite';

export type CaptureRow = {
  id: number;
  itemId: string; // slug of item
  title: string; // item title denormalized for convenience
  originalUri: string; // file:// uri to original image
  thumbnailUri: string; // file:// uri to 1:1 ~1024px jpeg
  createdAt: number; // epoch ms
  latitude?: number | null;
  longitude?: number | null;
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
  database.execSync(
    `CREATE TABLE IF NOT EXISTS captures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      itemId TEXT NOT NULL,
      title TEXT NOT NULL,
      originalUri TEXT NOT NULL,
      thumbnailUri TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      latitude REAL,
      longitude REAL
    );`
  );

  database.execSync(
    `CREATE INDEX IF NOT EXISTS idx_captures_item ON captures(itemId);`
  );
  database.execSync(
    `CREATE INDEX IF NOT EXISTS idx_captures_createdAt ON captures(createdAt);`
  );
}

export function insertCapture(row: Omit<CaptureRow, 'id'>): number {
  const database = getDb();
  const result = database.runSync(
    `INSERT INTO captures (itemId, title, originalUri, thumbnailUri, createdAt, latitude, longitude)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [
      row.itemId,
      row.title,
      row.originalUri,
      row.thumbnailUri,
      row.createdAt,
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

