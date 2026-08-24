import type { Pattern } from '@/constants/patterns';

export interface Movement {
  id: string;
  name: string;
  /** Exactly one pattern, required. */
  pattern: Pattern;
  createdAt: string; // ISO datetime
}

/**
 * A set is the atomic unit. There is no workouts/sessions table.
 * Heavy sessions are derived from runs of sets tagged `heavy`.
 */
export interface SetEntry {
  id: string;
  movementId: string;
  reps: number;
  /** Load in lb, optional. 0/undefined = bodyweight/empty-handed. */
  load?: number;
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

export function makeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}
