# Distributed Training Tracker

A single-user iPhone app (Expo) for logging short sets of exercise scattered through the day. All data stays on the device (AsyncStorage) — no backend, no accounts.

## Run & Operate

- Workflow `artifacts/training-tracker: expo` — Expo dev server (restart via workflows, never `npx expo` directly)
- `pnpm --filter @workspace/training-tracker run typecheck`

## Stack

- Expo SDK 54 / expo-router, React Native, TypeScript
- AsyncStorage for persistence (no database, no API server usage)

## Where things live

- `artifacts/training-tracker/lib/types.ts` — data model (Movement, SetEntry)
- `artifacts/training-tracker/lib/store.tsx` — TrainingProvider context + AsyncStorage persistence + seed movements
- `artifacts/training-tracker/constants/patterns.ts` — the six fixed movement patterns and their colors
- `artifacts/training-tracker/lib/csv.ts` — raw CSV export of all set rows
- Screens: `app/(tabs)/index.tsx` (Log), `today.tsx`, `movements.tsx`, `app/set/[id].tsx` (edit modal)
- Source spec: `attached_assets/Pasted--Distributed-Training-Tracker-Build-Prompt-*.txt`

## Architecture decisions

- Sets are the atomic unit; no sessions table. Heavy sessions will be derived (runs of `heavy` sets within 90 min).
- Every set stores a full ISO datetime; `timestampEdited` is flipped whenever `performedAt` is changed after logging — future notification logic depends on this flag.
- RIR is required (0–4, 4 = "4 or more").
- Movements carry exactly one pattern from a fixed list of six; pattern colors are constant everywhere.

## Product

Phase 1 (built): fast two-tap set logging with prefilled last reps, chronological today view with running rep total, user-defined movements, CSV export.
Phase 2 (deliberately deferred by user): local notification queue, heavy-session toggle, benchmarks, two targets, reports.

## User preferences

- Build logging first and stop — user wants to use it for a week before the rest exists.
- No streaks/gamification, no exercise library, no coaching, no goal system beyond the two specified targets, no accounts/sync.

## Gotchas

- iOS caps pending local notifications at 64; repeating triggers are forbidden by the spec (queue of one-off triggers instead).
- Do not rebuild the notification queue on backdated/edited sets — only on current-time logs or app open.
- `expo-file-system` is imported via `expo-file-system/legacy` for `writeAsStringAsync`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
