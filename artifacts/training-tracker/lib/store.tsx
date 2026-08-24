import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Pattern } from '@/constants/patterns';
import { makeId, Movement, SetEntry } from '@/lib/types';

const MOVEMENTS_KEY = 'dtt.movements.v1';
const SETS_KEY = 'dtt.sets.v1';
const LAST_MOVEMENT_KEY = 'dtt.lastMovement.v1';

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
  movements: Movement[];
  sets: SetEntry[];
  lastMovementId: string | null;
  addMovement: (name: string, pattern: Pattern) => Movement | null;
  deleteMovement: (id: string) => boolean;
  logSet: (input: {
    movementId: string;
    reps: number;
    rir: SetEntry['rir'];
    load?: number;
  }) => SetEntry;
  updateSet: (
    id: string,
    patch: Partial<Pick<SetEntry, 'reps' | 'rir' | 'load' | 'performedAt' | 'movementId'>>,
  ) => void;
  deleteSet: (id: string) => void;
  setLastMovementId: (id: string) => void;
}

const TrainingContext = createContext<TrainingState | null>(null);

export function TrainingProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [sets, setSets] = useState<SetEntry[]>([]);
  const [lastMovementId, setLastMovementIdState] = useState<string | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const [m, s, last] = await Promise.all([
          AsyncStorage.getItem(MOVEMENTS_KEY),
          AsyncStorage.getItem(SETS_KEY),
          AsyncStorage.getItem(LAST_MOVEMENT_KEY),
        ]);
        let movementsList: Movement[];
        if (m) {
          movementsList = JSON.parse(m) as Movement[];
        } else {
          movementsList = seedMovements();
          await AsyncStorage.setItem(MOVEMENTS_KEY, JSON.stringify(movementsList));
        }
        setMovements(movementsList);
        setSets(s ? (JSON.parse(s) as SetEntry[]) : []);
        setLastMovementIdState(last ?? movementsList[0]?.id ?? null);
      } finally {
        loaded.current = true;
        setReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(MOVEMENTS_KEY, JSON.stringify(movements));
  }, [movements]);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(SETS_KEY, JSON.stringify(sets));
  }, [sets]);

  const setLastMovementId = useCallback((id: string) => {
    setLastMovementIdState(id);
    AsyncStorage.setItem(LAST_MOVEMENT_KEY, id);
  }, []);

  const addMovement = useCallback(
    (name: string, pattern: Pattern): Movement | null => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const movement: Movement = {
        id: makeId(),
        name: trimmed,
        pattern,
        createdAt: new Date().toISOString(),
      };
      setMovements((prev) => [...prev, movement]);
      return movement;
    },
    [],
  );

  const deleteMovement = useCallback(
    (id: string): boolean => {
      let ok = false;
      setSets((currentSets) => {
        const hasSets = currentSets.some((s) => s.movementId === id);
        if (!hasSets) {
          ok = true;
          setMovements((prev) => prev.filter((m) => m.id !== id));
        }
        return currentSets;
      });
      return ok;
    },
    [],
  );

  const logSet = useCallback(
    (input: { movementId: string; reps: number; rir: SetEntry['rir']; load?: number }) => {
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
      setSets((prev) => [...prev, entry]);
      setLastMovementId(input.movementId);
      return entry;
    },
    [setLastMovementId],
  );

  const updateSet = useCallback(
    (
      id: string,
      patch: Partial<Pick<SetEntry, 'reps' | 'rir' | 'load' | 'performedAt' | 'movementId'>>,
    ) => {
      setSets((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s;
          const next = { ...s, ...patch };
          if (patch.performedAt && patch.performedAt !== s.performedAt) {
            next.timestampEdited = true;
          }
          return next;
        }),
      );
    },
    [],
  );

  const deleteSet = useCallback((id: string) => {
    setSets((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const value = useMemo(
    () => ({
      ready,
      movements,
      sets,
      lastMovementId,
      addMovement,
      deleteMovement,
      logSet,
      updateSet,
      deleteSet,
      setLastMovementId,
    }),
    [
      ready,
      movements,
      sets,
      lastMovementId,
      addMovement,
      deleteMovement,
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
      .filter((s) => new Date(s.performedAt).getTime() >= startMs)
      .sort((a, b) => a.performedAt.localeCompare(b.performedAt));
  }, [sets]);
}
