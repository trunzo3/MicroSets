import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Pattern } from '@/constants/patterns';
import {
  initializeDatabase,
  persistBand,
  persistLastMovement,
  persistMovement,
  persistMovementDefault,
  persistSet,
  persistSetPatch,
  removeBand,
  removeMovement,
  removeSet,
} from '@/lib/database';
import {
  makeId,
  type Load,
  type Movement,
  type ResistanceBand,
  type SetEntry,
  type SetPatch,
} from '@/lib/types';

function seedMovements(): Movement[] {
  const now = new Date().toISOString();
  const seed: Array<[string, Pattern]> = [
    ['Deep squat', 'squat'],
    ['Banded Romanian deadlift', 'hinge'],
    ['Push-up', 'horizontal push'],
    ['Pike push-up', 'vertical push'],
    ['Inverted row', 'horizontal pull'],
    ['Pull-up', 'vertical pull'],
  ];
  return seed.map(([name, pattern]) => ({
    id: makeId(),
    name,
    pattern,
    createdAt: now,
  }));
}

interface TrainingState {
  ready: boolean;
  error: Error | null;
  movements: Movement[];
  sets: SetEntry[];
  bands: ResistanceBand[];
  lastMovementId: string | null;
  addMovement: (name: string, pattern: Pattern, defaultLoad?: Load) => Promise<Movement | null>;
  deleteMovement: (id: string) => Promise<boolean>;
  updateMovementDefaultLoad: (id: string, defaultLoad?: Load) => Promise<void>;
  addBand: (name: string) => Promise<ResistanceBand | null>;
  deleteBand: (id: string) => Promise<boolean>;
  logSet: (input: {
    movementId: string;
    reps: number;
    rir: SetEntry['rir'];
    load?: Load;
  }) => Promise<SetEntry>;
  updateSet: (id: string, patch: SetPatch) => Promise<void>;
  deleteSet: (id: string) => Promise<void>;
  setLastMovementId: (id: string | null) => Promise<void>;
}

const TrainingContext = createContext<TrainingState | null>(null);

export function TrainingProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [sets, setSets] = useState<SetEntry[]>([]);
  const [bands, setBands] = useState<ResistanceBand[]>([]);
  const [lastMovementId, setLastMovementIdState] = useState<string | null>(null);
  const movementsRef = useRef<Movement[]>([]);
  const setsRef = useRef<SetEntry[]>([]);
  const bandsRef = useRef<ResistanceBand[]>([]);

  const commitMovements = useCallback((next: Movement[]) => {
    movementsRef.current = next;
    setMovements(next);
  }, []);
  const commitSets = useCallback((next: SetEntry[]) => {
    setsRef.current = next;
    setSets(next);
  }, []);
  const commitBands = useCallback((next: ResistanceBand[]) => {
    bandsRef.current = next;
    setBands(next);
  }, []);

  useEffect(() => {
    let active = true;
    initializeDatabase(seedMovements())
      .then((snapshot) => {
        if (!active) return;
        commitMovements(snapshot.movements);
        commitSets(snapshot.sets);
        commitBands(snapshot.bands);
        setLastMovementIdState(snapshot.lastMovementId);
        setReady(true);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause : new Error(String(cause)));
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, [commitBands, commitMovements, commitSets]);

  const setLastMovementId = useCallback(async (id: string | null): Promise<void> => {
    await persistLastMovement(id);
    setLastMovementIdState(id);
  }, []);

  const addMovement = useCallback(
    async (name: string, pattern: Pattern, defaultLoad?: Load): Promise<Movement | null> => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const movement: Movement = {
        id: makeId(),
        name: trimmed,
        pattern,
        createdAt: new Date().toISOString(),
        ...(defaultLoad ? { defaultLoad } : {}),
      };
      await persistMovement(movement);
      commitMovements([...movementsRef.current, movement]);
      return movement;
    },
    [commitMovements],
  );

  const deleteMovement = useCallback(
    async (id: string): Promise<boolean> => {
      const deleted = await removeMovement(id);
      if (deleted) commitMovements(movementsRef.current.filter((movement) => movement.id !== id));
      return deleted;
    },
    [commitMovements],
  );

  const updateMovementDefaultLoad = useCallback(
    async (id: string, defaultLoad?: Load): Promise<void> => {
      await persistMovementDefault(id, defaultLoad);
      commitMovements(
        movementsRef.current.map((movement) => {
          if (movement.id !== id) return movement;
          const { defaultLoad: _previous, ...withoutDefault } = movement;
          return defaultLoad ? { ...withoutDefault, defaultLoad } : withoutDefault;
        }),
      );
    },
    [commitMovements],
  );

  const addBand = useCallback(
    async (name: string): Promise<ResistanceBand | null> => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const band: ResistanceBand = {
        id: makeId(),
        name: trimmed,
        createdAt: new Date().toISOString(),
      };
      await persistBand(band);
      commitBands([...bandsRef.current, band]);
      return band;
    },
    [commitBands],
  );

  const deleteBand = useCallback(
    async (id: string): Promise<boolean> => {
      const band = bandsRef.current.find((candidate) => candidate.id === id);
      if (!band) return false;
      const deleted = await removeBand(id, band.name);
      if (deleted) commitBands(bandsRef.current.filter((candidate) => candidate.id !== id));
      return deleted;
    },
    [commitBands],
  );

  const logSet = useCallback(
    async (input: {
      movementId: string;
      reps: number;
      rir: SetEntry['rir'];
      load?: Load;
    }): Promise<SetEntry> => {
      const now = new Date().toISOString();
      const entry: SetEntry = {
        id: makeId(),
        movementId: input.movementId,
        reps: input.reps,
        rir: input.rir,
        performedAt: now,
        loggedAt: now,
        heavy: false,
        timestampEdited: false,
        ...(input.load ? { load: input.load } : {}),
      };
      await persistSet(entry);
      commitSets([...setsRef.current, entry]);
      setLastMovementIdState(input.movementId);
      return entry;
    },
    [commitSets],
  );

  const updateSet = useCallback(
    async (id: string, patch: SetPatch): Promise<void> => {
      const next = await persistSetPatch(id, patch);
      commitSets(setsRef.current.map((entry) => (entry.id === id ? next : entry)));
    },
    [commitSets],
  );

  const deleteSet = useCallback(
    async (id: string): Promise<void> => {
      await removeSet(id);
      commitSets(setsRef.current.filter((entry) => entry.id !== id));
    },
    [commitSets],
  );

  const value = useMemo(
    () => ({
      ready,
      error,
      movements,
      sets,
      bands,
      lastMovementId,
      addMovement,
      deleteMovement,
      updateMovementDefaultLoad,
      addBand,
      deleteBand,
      logSet,
      updateSet,
      deleteSet,
      setLastMovementId,
    }),
    [
      ready,
      error,
      movements,
      sets,
      bands,
      lastMovementId,
      addMovement,
      deleteMovement,
      updateMovementDefaultLoad,
      addBand,
      deleteBand,
      logSet,
      updateSet,
      deleteSet,
      setLastMovementId,
    ],
  );

  return <TrainingContext.Provider value={value}>{children}</TrainingContext.Provider>;
}

export function useTraining(): TrainingState {
  const ctx = useContext(TrainingContext);
  if (!ctx) throw new Error('useTraining must be used within TrainingProvider');
  return ctx;
}

/** Sets performed today, sorted ascending by performedAt. */
export function useTodaySets(): SetEntry[] {
  const { sets } = useTraining();
  return useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startMs = start.getTime();
    return sets
      .filter((set) => new Date(set.performedAt).getTime() >= startMs)
      .sort((a, b) => a.performedAt.localeCompare(b.performedAt));
  }, [sets]);
}