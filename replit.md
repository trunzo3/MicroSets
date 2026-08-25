# Distributed Training Tracker

A single-user iPhone app (Expo) for logging short sets of exercise scattered through the day. All data stays on the device in SQLite — no backend, no accounts.

## Run & Operate

- Workflow `artifacts/training-tracker: expo` — Expo dev server (restart via workflows, never `npx expo` directly)
- `pnpm --filter @workspace/training-tracker run typecheck`

## Stack

- Expo SDK 54 / expo-router, React Native, TypeScript
- `expo-sqlite` for on-device persistence and future report queries
- AsyncStorage is read only for the one-time legacy migration; there is no backend or API server usage

## Where things live

- `artifacts/training-tracker/lib/types.ts` — data model (Movement, ResistanceBand, Load, SetEntry)
- `artifacts/training-tracker/lib/database.ts` — SQLite schema, indexed queries, legacy migration, and persistence
- `artifacts/training-tracker/lib/store.tsx` — TrainingProvider context, serialized mutations, and seed movements
- `artifacts/training-tracker/constants/patterns.ts` — the six fixed movement patterns and their colors
- `artifacts/training-tracker/lib/csv.ts` — raw CSV export of all set rows
- Screens: `app/(tabs)/index.tsx` (Log), `today.tsx`, `movements.tsx`, `app/set/[id].tsx` (edit modal)
- Source spec: `attached_assets/Pasted--Distributed-Training-Tracker-Build-Prompt-*.txt`

## Architecture decisions

- Sets are the atomic unit; no sessions table. Heavy sessions will be derived (runs of `heavy` sets within 90 min).
- Every set stores a full ISO datetime; `timestampEdited` is flipped whenever `performedAt` is changed after logging — future notification logic depends on this flag.
- RIR is required (0–4, 4 = "4 or more").
- Movements carry exactly one pattern from a fixed list of six; pattern colors are constant everywhere.
- Load is either pounds or a named resistance band. Movement defaults only prefill the logger; the chosen load is copied onto each set so later default changes never rewrite history.
- Resistance-band names are managed on the Movements screen and stored separately from historical set load values.
- Phase 2 Progress series must group by movement and distinct load. Bodyweight, each pounds value, and each named band are separate series.

## Product

Phase 1 (built): fast two-tap set logging from a fixed movement grid, prefilled last reps and optional default loads, chronological today view with running rep total, user-defined movements/bands, CSV export.
Phase 2 (deliberately deferred by user): local notification queue, heavy-session toggle, benchmarks, two targets, reports.

## User preferences

- Build logging first and stop — user wants to use it for a week before the rest exists.
- No streaks/gamification, no exercise library, no coaching, no goal system beyond the two specified targets, no accounts/sync.

## Gotchas

- iOS caps pending local notifications at 64; repeating triggers are forbidden by the spec (queue of one-off triggers instead).
- Do not rebuild the notification queue on backdated/edited sets — only on current-time logs or app open.
- `expo-file-system` is imported via `expo-file-system/legacy` for `writeAsStringAsync`.
- `expo-sqlite` web preview requires `wasm` in Metro's asset extensions; native iOS uses the bundled module directly.
- The legacy AsyncStorage keys are intentionally retained after successful migration as a rollback backup, but all new writes go only to SQLite.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
