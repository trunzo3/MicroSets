import type { Pattern } from '@/constants/patterns';

/** A load is either external weight in pounds or a named resistance band. */
export type Load =
  | { kind: 'pounds'; pounds: number }
  | { kind: 'band'; band: string };

export function formatLoad(load?: Load): string {
  if (!load) return 'Bodyweight';
  return load.kind === 'pounds' ? `${load.pounds} lb` : load.band;
}

/** A resistance band name available when choosing loads and defaults. */
export interface ResistanceBand {
  id: string;
  name: string;
  createdAt: string; // ISO datetime
}

export interface Movement {
  id: string;
  name: string;
  /** Exactly one pattern, required. */
  pattern: Pattern;
  createdAt: string; // ISO datetime
  defaultLoad?: Load;
}

/**
 * A set is the atomic unit. There is no workouts/sessions table.
 * Heavy sessions are derived from runs of sets tagged `heavy`.
 */
export interface SetEntry {
  id: string;
  movementId: string;
  reps: number;
  /** Omitted for bodyweight/empty-handed sets. */
  load?: Load;
  /** RIR 0-4, required. 4 means "4 or more". */
  rir: 0 | 1 | 2 | 3 | 4;
  /** Full datetime the set was performed. */
  performedAt: string; // ISO datetime
  /** Datetime the row was created in the app. */
  loggedAt: string; // ISO datetime
  /** True while a heavy session toggle is on (phase 2; always false for now). */
  heavy: boolean;
  /** True if the user edited performedAt after logging. Notification logic depends on this. */
  timestampEdited: boolean;
}

export type SetPatch = Partial<
  Pick<SetEntry, 'reps' | 'rir' | 'load' | 'performedAt' | 'movementId'>
>;

export function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}
