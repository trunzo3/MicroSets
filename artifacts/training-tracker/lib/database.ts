import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';
import { PATTERNS, type Pattern } from '@/constants/patterns';
import type {
  Load,
  Movement,
  ResistanceBand,
  SetEntry,
  SetPatch,
} from '@/lib/types';

const DATABASE_NAME = 'distributed-training-tracker.db';
const MOVEMENTS_KEY = 'dtt.movements.v1';
const SETS_KEY = 'dtt.sets.v1';
const LAST_MOVEMENT_KEY = 'dtt.lastMovement.v1';
const MIGRATION_KEY = 'async_storage_v1_migrated';
const LAST_MOVEMENT_META_KEY = 'last_movement_id';

interface MovementRow {
  id: string;
  name: string;
  pattern: string;
  created_at: string;
  default_load_kind: string | null;
  default_load_value: string | null;
}

interface SetRow {
  id: string;
  movement_id: string;
  reps: number;
  rir: number;
  load_kind: string | null;
  load_value: string | null;
  performed_at: string;
  logged_at: string;
  heavy: number;
  timestamp_edited: number;
}

interface BandRow {
  id: string;
  name: string;
  created_at: string;
}

export interface DatabaseSnapshot {
  movements: Movement[];
  sets: SetEntry[];
  bands: ResistanceBand[];
  lastMovementId: string | null;
}

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let initializationPromise: Promise<void> | null = null;
let writeTail: Promise<void> = Promise.resolve();

function database(): Promise<SQLite.SQLiteDatabase> {
  databasePromise ??= SQLite.openDatabaseAsync(DATABASE_NAME);
  return databasePromise;
}

function serializeLoad(load?: Load): [string | null, string | null] {
  if (!load) return [null, null];
  return load.kind === 'pounds'
    ? ['pounds', String(load.pounds)]
    : ['band', load.band];
}

function deserializeLoad(kind: string | null, value: string | null): Load | undefined {
  if (kind === 'pounds' && value != null) {
    const pounds = Number(value);
    return Number.isFinite(pounds) ? { kind: 'pounds', pounds } : undefined;
  }
  if (kind === 'band' && value != null) return { kind: 'band', band: value };
  return undefined;
}

function movementFromRow(row: MovementRow): Movement {
  const defaultLoad = deserializeLoad(row.default_load_kind, row.default_load_value);
  return {
    id: row.id,
    name: row.name,
    pattern: row.pattern as Pattern,
    createdAt: row.created_at,
    ...(defaultLoad ? { defaultLoad } : {}),
  };
}

function setFromRow(row: SetRow): SetEntry {
  const load = deserializeLoad(row.load_kind, row.load_value);
  return {
    id: row.id,
    movementId: row.movement_id,
    reps: row.reps,
    rir: row.rir as SetEntry['rir'],
    performedAt: row.performed_at,
    loggedAt: row.logged_at,
    heavy: row.heavy !== 0,
    timestampEdited: row.timestamp_edited !== 0,
    ...(load ? { load } : {}),
  };
}

async function createSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS movements (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      pattern TEXT NOT NULL,
      created_at TEXT NOT NULL,
      default_load_kind TEXT,
      default_load_value TEXT,
      CHECK (default_load_kind IS NULL OR default_load_kind IN ('pounds', 'band')),
      CHECK ((default_load_kind IS NULL) = (default_load_value IS NULL))
    );
    CREATE TABLE IF NOT EXISTS sets (
      id TEXT PRIMARY KEY NOT NULL,
      movement_id TEXT NOT NULL REFERENCES movements(id) ON DELETE RESTRICT,
      reps INTEGER NOT NULL,
      rir INTEGER NOT NULL,
      load_kind TEXT,
      load_value TEXT,
      performed_at TEXT NOT NULL,
      logged_at TEXT NOT NULL,
      heavy INTEGER NOT NULL DEFAULT 0,
      timestamp_edited INTEGER NOT NULL DEFAULT 0,
      CHECK (rir BETWEEN 0 AND 4),
      CHECK (load_kind IS NULL OR load_kind IN ('pounds', 'band')),
      CHECK ((load_kind IS NULL) = (load_value IS NULL))
    );
    CREATE TABLE IF NOT EXISTS bands (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sets_performed_at ON sets(performed_at);
    CREATE INDEX IF NOT EXISTS idx_sets_movement_performed
      ON sets(movement_id, performed_at);
    CREATE INDEX IF NOT EXISTS idx_sets_load_series
      ON sets(movement_id, load_kind, load_value, performed_at);
    CREATE INDEX IF NOT EXISTS idx_movements_pattern ON movements(pattern);
  `);
}

function parseArray(value: string | null): unknown[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPattern(value: unknown): value is Pattern {
  return typeof value === 'string' && PATTERNS.includes(value as Pattern);
}

async function migrateLegacyStorage(db: SQLite.SQLiteDatabase): Promise<void> {
  const marker = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_metadata WHERE key = ?',
    MIGRATION_KEY,
  );
  if (marker) return;

  const [movementJson, setJson, lastMovementId] = await Promise.all([
    AsyncStorage.getItem(MOVEMENTS_KEY),
    AsyncStorage.getItem(SETS_KEY),
    AsyncStorage.getItem(LAST_MOVEMENT_KEY),
  ]);
  const legacyMovements = parseArray(movementJson);
  const legacySets = parseArray(setJson);
  const existingMovements = await db.getAllAsync<{ id: string }>('SELECT id FROM movements');
  const movementIds = new Set(existingMovements.map((row) => row.id));
  let skippedMovements = 0;
  let skippedSets = 0;

  await db.withTransactionAsync(async () => {
    for (const value of legacyMovements) {
      if (!isRecord(value)) {
        skippedMovements += 1;
        continue;
      }
      if (
        typeof value.id !== 'string' ||
        typeof value.name !== 'string' ||
        !isPattern(value.pattern) ||
        typeof value.createdAt !== 'string'
      ) {
        skippedMovements += 1;
        continue;
      }
      await db.runAsync(
        `INSERT OR IGNORE INTO movements
          (id, name, pattern, created_at, default_load_kind, default_load_value)
         VALUES (?, ?, ?, ?, NULL, NULL)`,
        value.id,
        value.name,
        value.pattern,
        value.createdAt,
      );
      movementIds.add(value.id);
    }

    for (const value of legacySets) {
      if (!isRecord(value)) {
        skippedSets += 1;
        continue;
      }
      if (
        typeof value.id !== 'string' ||
        typeof value.movementId !== 'string' ||
        !movementIds.has(value.movementId) ||
        typeof value.reps !== 'number' ||
        !Number.isInteger(value.reps) ||
        value.reps <= 0 ||
        typeof value.rir !== 'number' ||
        !Number.isInteger(value.rir) ||
        value.rir < 0 ||
        value.rir > 4 ||
        typeof value.performedAt !== 'string' ||
        typeof value.loggedAt !== 'string'
      ) {
        skippedSets += 1;
        continue;
      }
      const load =
        typeof value.load === 'number' && Number.isFinite(value.load) && value.load > 0
          ? ({ kind: 'pounds', pounds: value.load } satisfies Load)
          : undefined;
      const [loadKind, loadValue] = serializeLoad(load);
      await db.runAsync(
        `INSERT OR IGNORE INTO sets
          (id, movement_id, reps, rir, load_kind, load_value, performed_at, logged_at,
           heavy, timestamp_edited)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        value.id,
        value.movementId,
        value.reps,
        value.rir,
        loadKind,
        loadValue,
        value.performedAt,
        value.loggedAt,
        value.heavy === true ? 1 : 0,
        value.timestampEdited === true ? 1 : 0,
      );
    }

    if (lastMovementId && movementIds.has(lastMovementId)) {
      await db.runAsync(
        'INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)',
        LAST_MOVEMENT_META_KEY,
        lastMovementId,
      );
    }
    await db.runAsync(
      'INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)',
      'async_storage_v1_skipped_rows',
      JSON.stringify({ movements: skippedMovements, sets: skippedSets }),
    );
    await db.runAsync(
      'INSERT INTO app_metadata (key, value) VALUES (?, ?)',
      MIGRATION_KEY,
      new Date().toISOString(),
    );
  });
}

async function readSnapshot(db: SQLite.SQLiteDatabase): Promise<DatabaseSnapshot> {
  const [movementRows, setRows, bandRows, lastRow] = await Promise.all([
    db.getAllAsync<MovementRow>('SELECT * FROM movements ORDER BY created_at, rowid'),
    db.getAllAsync<SetRow>('SELECT * FROM sets ORDER BY performed_at, id'),
    db.getAllAsync<BandRow>('SELECT * FROM bands ORDER BY created_at, id'),
    db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_metadata WHERE key = ?',
      LAST_MOVEMENT_META_KEY,
    ),
  ]);
  return {
    movements: movementRows.map(movementFromRow),
    sets: setRows.map(setFromRow),
    bands: bandRows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
    })),
    lastMovementId: lastRow?.value ?? movementRows[0]?.id ?? null,
  };
}

export function initializeDatabase(seed: Movement[]): Promise<DatabaseSnapshot> {
  initializationPromise ??= (async () => {
    const db = await database();
    await createSchema(db);
    await migrateLegacyStorage(db);
    const count = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM movements',
    );
    if ((count?.count ?? 0) === 0) {
      await db.withTransactionAsync(async () => {
        for (const movement of seed) await insertMovement(db, movement);
      });
    }
  })();
  return initializationPromise.then(async () => readSnapshot(await database()));
}

function enqueueWrite<T>(operation: (db: SQLite.SQLiteDatabase) => Promise<T>): Promise<T> {
  const result = writeTail.then(async () => operation(await database()));
  writeTail = result.then(() => undefined, () => undefined);
  return result;
}

async function insertMovement(db: SQLite.SQLiteDatabase, movement: Movement): Promise<void> {
  const [kind, value] = serializeLoad(movement.defaultLoad);
  await db.runAsync(
    `INSERT INTO movements
      (id, name, pattern, created_at, default_load_kind, default_load_value)
     VALUES (?, ?, ?, ?, ?, ?)`,
    movement.id,
    movement.name,
    movement.pattern,
    movement.createdAt,
    kind,
    value,
  );
}

export function persistMovement(movement: Movement): Promise<void> {
  return enqueueWrite((db) => insertMovement(db, movement));
}

export function persistMovementDefault(id: string, load?: Load): Promise<void> {
  return enqueueWrite(async (db) => {
    const [kind, value] = serializeLoad(load);
    const result = await db.runAsync(
      'UPDATE movements SET default_load_kind = ?, default_load_value = ? WHERE id = ?',
      kind,
      value,
      id,
    );
    if (result.changes === 0) throw new Error('Movement not found');
  });
}

export function removeMovement(id: string): Promise<boolean> {
  return enqueueWrite(async (db) => {
    const result = await db.runAsync(
      `DELETE FROM movements
       WHERE id = ? AND NOT EXISTS (SELECT 1 FROM sets WHERE movement_id = ?)`,
      id,
      id,
    );
    return result.changes > 0;
  });
}

export function persistBand(band: ResistanceBand): Promise<void> {
  return enqueueWrite(async (db) => {
    await db.runAsync(
      'INSERT INTO bands (id, name, created_at) VALUES (?, ?, ?)',
      band.id,
      band.name,
      band.createdAt,
    );
  });
}

export function removeBand(id: string, name: string): Promise<boolean> {
  return enqueueWrite(async (db) => {
    const result = await db.runAsync(
      `DELETE FROM bands
       WHERE id = ? AND NOT EXISTS (
         SELECT 1 FROM movements
         WHERE default_load_kind = 'band' AND default_load_value = ? COLLATE NOCASE
       )`,
      id,
      name,
    );
    return result.changes > 0;
  });
}

export function persistSet(entry: SetEntry): Promise<void> {
  return enqueueWrite(async (db) => {
    const [kind, value] = serializeLoad(entry.load);
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO sets
          (id, movement_id, reps, rir, load_kind, load_value, performed_at, logged_at,
           heavy, timestamp_edited)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        entry.id,
        entry.movementId,
        entry.reps,
        entry.rir,
        kind,
        value,
        entry.performedAt,
        entry.loggedAt,
        entry.heavy ? 1 : 0,
        entry.timestampEdited ? 1 : 0,
      );
      await db.runAsync(
        'INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)',
        LAST_MOVEMENT_META_KEY,
        entry.movementId,
      );
    });
  });
}

async function updateSetRow(db: SQLite.SQLiteDatabase, entry: SetEntry): Promise<void> {
  const [kind, value] = serializeLoad(entry.load);
  const result = await db.runAsync(
    `UPDATE sets SET movement_id = ?, reps = ?, rir = ?, load_kind = ?,
     load_value = ?, performed_at = ?, logged_at = ?, heavy = ?,
     timestamp_edited = ? WHERE id = ?`,
    entry.movementId,
    entry.reps,
    entry.rir,
    kind,
    value,
    entry.performedAt,
    entry.loggedAt,
    entry.heavy ? 1 : 0,
    entry.timestampEdited ? 1 : 0,
    entry.id,
  );
  if (result.changes === 0) throw new Error('Set not found');
}

export function persistSetPatch(id: string, patch: SetPatch): Promise<SetEntry> {
  return enqueueWrite(async (db) => {
    const row = await db.getFirstAsync<SetRow>('SELECT * FROM sets WHERE id = ?', id);
    if (!row) throw new Error('Set not found');
    const current = setFromRow(row);
    const next: SetEntry = { ...current, ...patch };
    if (patch.performedAt !== undefined && patch.performedAt !== current.performedAt) {
      next.timestampEdited = true;
    }
    await updateSetRow(db, next);
    return next;
  });
}

export function removeSet(id: string): Promise<void> {
  return enqueueWrite(async (db) => {
    await db.runAsync('DELETE FROM sets WHERE id = ?', id);
  });
}

export function persistLastMovement(id: string | null): Promise<void> {
  return enqueueWrite(async (db) => {
    if (id == null) {
      await db.runAsync('DELETE FROM app_metadata WHERE key = ?', LAST_MOVEMENT_META_KEY);
    } else {
      await db.runAsync(
        'INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)',
        LAST_MOVEMENT_META_KEY,
        id,
      );
    }
  });
}