import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { PATTERN_COLORS } from '@/constants/patterns';
import { useTodaySets, useTraining } from '@/lib/store';
import type { SetEntry } from '@/lib/types';

const RIR_VALUES: SetEntry['rir'][] = [0, 1, 2, 3, 4];

export default function LogScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { ready, movements, sets, lastMovementId, logSet } = useTraining();
  const todaySets = useTodaySets();

  const [movementId, setMovementId] = useState<string | null>(null);
  const [reps, setReps] = useState<number>(10);
  const [repsText, setRepsText] = useState<string>('10');
  const [rir, setRir] = useState<SetEntry['rir'] | null>(null);
  const [load, setLoad] = useState<string>('');
  const flash = useRef(new Animated.Value(0)).current;

  const selected = movements.find((m) => m.id === movementId) ?? null;

  // Initialize selection once data loads.
  useEffect(() => {
    if (ready && !movementId && movements.length > 0) {
      setMovementId(lastMovementId ?? movements[0]!.id);
    }
  }, [ready, movementId, movements, lastMovementId]);

  // Prefill last rep count + load for the selected movement.
  const lastForMovement = useMemo(() => {
    if (!movementId) return null;
    for (let i = sets.length - 1; i >= 0; i--) {
      if (sets[i]!.movementId === movementId) return sets[i]!;
    }
    return null;
  }, [sets, movementId]);

  useEffect(() => {
    if (!movementId) return;
    const r = lastForMovement?.reps ?? 10;
    setReps(r);
    setRepsText(String(r));
    setLoad(lastForMovement?.load ? String(lastForMovement.load) : '');
    setRir(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movementId]);

  const todayReps = todaySets.reduce((sum, s) => sum + s.reps, 0);

  const adjustReps = (delta: number) => {
    const next = Math.max(1, reps + delta);
    setReps(next);
    setRepsText(String(next));
    if (Platform.OS !== 'web') Haptics.selectionAsync();
  };

  const onRepsText = (t: string) => {
    setRepsText(t.replace(/[^0-9]/g, ''));
    const n = parseInt(t, 10);
    if (!Number.isNaN(n) && n > 0) setReps(n);
  };

  const canLog = !!selected && rir !== null && reps > 0;

  const onLog = () => {
    if (!selected || rir === null) return;
    const parsedLoad = parseFloat(load);
    logSet({
      movementId: selected.id,
      reps,
      rir,
      ...(Number.isFinite(parsedLoad) && parsedLoad > 0 ? { load: parsedLoad } : {}),
    });
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setRir(null);
    flash.setValue(1);
    Animated.timing(flash, { toValue: 0, duration: 900, useNativeDriver: true }).start();
  };

  const patternColor = selected ? PATTERN_COLORS[selected.pattern] : colors.primary;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: Platform.OS === 'web' ? 67 : insets.top,
        },
      ]}
    >
      {/* Header: today's running total */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerLabel, { color: colors.mutedForeground }]}>TODAY</Text>
          <Text style={[styles.headerTotal, { color: colors.foreground }]}>
            {todayReps} <Text style={[styles.headerUnit, { color: colors.mutedForeground }]}>reps</Text>
          </Text>
        </View>
        <Animated.View style={{ opacity: flash }}>
          <Text style={[styles.loggedFlash, { color: patternColor }]}>Logged</Text>
        </Animated.View>
      </View>

      {/* Movement chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
        contentContainerStyle={styles.chipRowContent}
      >
        {movements.map((m) => {
          const active = m.id === movementId;
          const c = PATTERN_COLORS[m.pattern];
          return (
            <Pressable
              key={m.id}
              onPress={() => setMovementId(m.id)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: active ? c : colors.card,
                  borderColor: active ? c : colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <View style={[styles.chipDot, { backgroundColor: active ? '#00000055' : c }]} />
              <Text
                style={[
                  styles.chipText,
                  { color: active ? '#141414' : colors.foreground },
                ]}
                numberOfLines={1}
              >
                {m.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Reps */}
      <View style={styles.repsBlock}>
        <Pressable
          onPress={() => adjustReps(-1)}
          onLongPress={() => adjustReps(-5)}
          style={({ pressed }) => [
            styles.stepBtn,
            { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.stepBtnText, { color: colors.foreground }]}>−</Text>
        </Pressable>
        <View style={styles.repsCenter}>
          <TextInput
            value={repsText}
            onChangeText={onRepsText}
            keyboardType="number-pad"
            returnKeyType="done"
            style={[styles.repsInput, { color: colors.foreground }]}
            maxLength={3}
            selectTextOnFocus
          />
          <Text style={[styles.repsLabel, { color: colors.mutedForeground }]}>reps</Text>
        </View>
        <Pressable
          onPress={() => adjustReps(1)}
          onLongPress={() => adjustReps(5)}
          style={({ pressed }) => [
            styles.stepBtn,
            { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.stepBtnText, { color: colors.foreground }]}>+</Text>
        </Pressable>
      </View>

      {/* Load (optional) */}
      <View style={styles.loadRow}>
        <Text style={[styles.loadLabel, { color: colors.mutedForeground }]}>Load</Text>
        <TextInput
          value={load}
          onChangeText={(t) => setLoad(t.replace(/[^0-9.]/g, ''))}
          keyboardType="decimal-pad"
          returnKeyType="done"
          placeholder="0"
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.loadInput,
            {
              color: colors.foreground,
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
          maxLength={5}
        />
        <Text style={[styles.loadLabel, { color: colors.mutedForeground }]}>lb</Text>
      </View>

      {/* RIR */}
      <Text style={[styles.rirLabel, { color: colors.mutedForeground }]}>REPS IN RESERVE</Text>
      <View style={styles.rirRow}>
        {RIR_VALUES.map((v) => {
          const active = rir === v;
          return (
            <Pressable
              key={v}
              onPress={() => {
                setRir(v);
                if (Platform.OS !== 'web') Haptics.selectionAsync();
              }}
              style={({ pressed }) => [
                styles.rirBtn,
                {
                  backgroundColor: active ? patternColor : colors.card,
                  borderColor: active ? patternColor : colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.rirBtnText,
                  { color: active ? '#141414' : colors.foreground },
                ]}
              >
                {v === 4 ? '4+' : v}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />

      {/* LOG */}
      <Pressable
        onPress={onLog}
        disabled={!canLog}
        style={({ pressed }) => [
          styles.logBtn,
          {
            backgroundColor: canLog ? patternColor : colors.secondary,
            opacity: pressed ? 0.85 : 1,
            marginBottom: Platform.OS === 'web' ? 100 : 96 + insets.bottom * 0.3,
          },
        ]}
      >
        <Text
          style={[
            styles.logBtnText,
            { color: canLog ? '#141414' : colors.mutedForeground },
          ]}
        >
          {canLog ? 'LOG' : rir === null ? 'TAP RIR TO LOG' : 'LOG'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.5 },
  headerTotal: { fontSize: 40, fontFamily: 'Inter_700Bold', lineHeight: 46 },
  headerUnit: { fontSize: 18, fontFamily: 'Inter_500Medium' },
  loggedFlash: { fontSize: 16, fontFamily: 'Inter_600SemiBold', paddingBottom: 8 },
  chipRow: { flexGrow: 0, marginTop: 12 },
  chipRowContent: { gap: 8, paddingRight: 20 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
    maxWidth: 220,
  },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  repsBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
  },
  stepBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontSize: 32, fontFamily: 'Inter_500Medium', lineHeight: 38 },
  repsCenter: { alignItems: 'center' },
  repsInput: {
    fontSize: 64,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    minWidth: 120,
    padding: 0,
  },
  repsLabel: { fontSize: 14, fontFamily: 'Inter_500Medium', marginTop: -4 },
  loadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 16,
  },
  loadLabel: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  loadInput: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 72,
    textAlign: 'center',
  },
  rirLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.5,
    marginTop: 28,
    marginBottom: 10,
  },
  rirRow: { flexDirection: 'row', gap: 10 },
  rirBtn: {
    flex: 1,
    aspectRatio: 1,
    maxHeight: 64,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rirBtnText: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  logBtn: {
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logBtnText: { fontSize: 18, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
});
