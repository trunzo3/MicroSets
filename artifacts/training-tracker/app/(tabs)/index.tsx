import React, { useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PATTERN_COLORS } from '@/constants/patterns';
import { useColors } from '@/hooks/useColors';
import { useTodaySets, useTraining } from '@/lib/store';
import type { Load, Movement, SetEntry } from '@/lib/types';

const RIR_VALUES: SetEntry['rir'][] = [0, 1, 2, 3, 4];
type LoadMode = 'pounds' | 'band';

export default function LogScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { ready, error, movements, sets, bands, logSet } = useTraining();
  const todaySets = useTodaySets();

  const [movementId, setMovementId] = useState<string | null>(null);
  const [reps, setReps] = useState(10);
  const [repsText, setRepsText] = useState('10');
  const [loadExpanded, setLoadExpanded] = useState(false);
  const [loadMode, setLoadMode] = useState<LoadMode>('pounds');
  const [poundsText, setPoundsText] = useState('');
  const [bandName, setBandName] = useState('');
  const [isLogging, setIsLogging] = useState(false);
  const [flashColor, setFlashColor] = useState(colors.primary);
  const flash = useRef(new Animated.Value(0)).current;

  const selected = movements.find((movement) => movement.id === movementId) ?? null;
  const todayReps = todaySets.reduce((sum, set) => sum + set.reps, 0);
  const patternColor = selected ? PATTERN_COLORS[selected.pattern] : colors.primary;
  const compactTiles = movements.length > 6;

  const resetLoad = () => {
    setLoadExpanded(false);
    setLoadMode('pounds');
    setPoundsText('');
    setBandName('');
  };

  const selectMovement = (movement: Movement) => {
    let lastReps = 10;
    for (let index = sets.length - 1; index >= 0; index -= 1) {
      if (sets[index]?.movementId === movement.id) {
        lastReps = sets[index]!.reps;
        break;
      }
    }
    setMovementId(movement.id);
    setReps(lastReps);
    setRepsText(String(lastReps));

    if (movement.defaultLoad?.kind === 'pounds') {
      setLoadExpanded(true);
      setLoadMode('pounds');
      setPoundsText(String(movement.defaultLoad.pounds));
      setBandName('');
    } else if (movement.defaultLoad?.kind === 'band') {
      setLoadExpanded(true);
      setLoadMode('band');
      setBandName(movement.defaultLoad.band);
      setPoundsText('');
    } else {
      resetLoad();
    }
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
  };

  const adjustReps = (delta: number) => {
    const next = Math.max(1, reps + delta);
    setReps(next);
    setRepsText(String(next));
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
  };

  const onRepsText = (text: string) => {
    const clean = text.replace(/[^0-9]/g, '');
    setRepsText(clean);
    const parsed = Number.parseInt(clean, 10);
    if (Number.isFinite(parsed) && parsed > 0) setReps(parsed);
  };

  const selectedLoad = (): Load | undefined => {
    if (!loadExpanded) return undefined;
    if (loadMode === 'pounds') {
      const pounds = Number.parseFloat(poundsText);
      return Number.isFinite(pounds) && pounds > 0 ? { kind: 'pounds', pounds } : undefined;
    }
    return bandName ? { kind: 'band', band: bandName } : undefined;
  };

  const commitSet = async (rir: SetEntry['rir']) => {
    if (!selected || isLogging || reps <= 0) return;
    const load = selectedLoad();
    if (loadExpanded && !load) {
      Alert.alert(
        'Choose a load',
        loadMode === 'pounds'
          ? 'Enter a positive weight in pounds.'
          : 'Choose a resistance band.',
      );
      return;
    }

    setIsLogging(true);
    try {
      await logSet({
        movementId: selected.id,
        reps,
        rir,
        ...(load ? { load } : {}),
      });
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setFlashColor(PATTERN_COLORS[selected.pattern]);
      setMovementId(null);
      setReps(10);
      setRepsText('10');
      resetLoad();
      flash.setValue(1);
      Animated.timing(flash, {
        toValue: 0,
        duration: 900,
        useNativeDriver: true,
      }).start();
    } catch (cause) {
      Alert.alert('Could not log set', cause instanceof Error ? cause.message : 'Unknown error');
    } finally {
      setIsLogging(false);
    }
  };

  if (ready && error) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorTitle, { color: colors.foreground }]}>Storage unavailable</Text>
        <Text style={[styles.errorText, { color: colors.mutedForeground }]}>{error.message}</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: Platform.OS === 'web' ? 67 : insets.top,
          paddingBottom: Platform.OS === 'web' ? 96 : 82 + insets.bottom * 0.25,
        },
      ]}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerLabel, { color: colors.mutedForeground }]}>TODAY</Text>
          <Text style={[styles.headerTotal, { color: colors.foreground }]}>
            {todayReps}{' '}
            <Text style={[styles.headerUnit, { color: colors.mutedForeground }]}>reps</Text>
          </Text>
        </View>
        <Animated.View style={{ opacity: flash }}>
          <Text style={[styles.loggedFlash, { color: flashColor }]}>Logged</Text>
        </Animated.View>
      </View>

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

      <View style={styles.loadArea}>
        {!loadExpanded ? (
          <Pressable
            onPress={() => setLoadExpanded(true)}
            style={({ pressed }) => [styles.addLoad, { opacity: pressed ? 0.65 : 1 }]}
          >
            <Feather name="plus" size={14} color={colors.mutedForeground} />
            <Text style={[styles.addLoadText, { color: colors.mutedForeground }]}>add load</Text>
          </Pressable>
        ) : (
          <View style={styles.loadExpanded}>
            <View style={styles.loadModeRow}>
              {(['pounds', 'band'] as const).map((mode) => {
                const active = loadMode === mode;
                return (
                  <Pressable
                    key={mode}
                    onPress={() => setLoadMode(mode)}
                    style={[
                      styles.loadModeBtn,
                      {
                        backgroundColor: active ? colors.foreground : colors.secondary,
                        borderColor: active ? colors.foreground : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.loadModeText,
                        { color: active ? colors.background : colors.mutedForeground },
                      ]}
                    >
                      {mode === 'pounds' ? 'lb' : 'Band'}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable onPress={resetLoad} hitSlop={8} style={styles.clearLoad}>
                <Feather name="x" size={17} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {loadMode === 'pounds' ? (
              <View style={styles.poundsRow}>
                <TextInput
                  value={poundsText}
                  onChangeText={(text) => setPoundsText(text.replace(/[^0-9.]/g, ''))}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  placeholder="0"
                  placeholderTextColor={colors.mutedForeground}
                  style={[
                    styles.poundsInput,
                    {
                      color: colors.foreground,
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                  maxLength={6}
                />
                <Text style={[styles.loadUnit, { color: colors.mutedForeground }]}>lb</Text>
              </View>
            ) : bands.length > 0 ? (
              <View style={styles.bandRow}>
                {bands.map((band) => {
                  const active = band.name === bandName;
                  return (
                    <Pressable
                      key={band.id}
                      onPress={() => setBandName(band.name)}
                      style={[
                        styles.bandBtn,
                        {
                          backgroundColor: active ? patternColor : colors.card,
                          borderColor: active ? patternColor : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.bandBtnText,
                          { color: active ? '#141414' : colors.foreground },
                        ]}
                      >
                        {band.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={[styles.noBands, { color: colors.mutedForeground }]}>
                Add band names in Movements first.
              </Text>
            )}
          </View>
        )}
      </View>

      <View style={styles.movementArea}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>MOVEMENT</Text>
        <View style={styles.movementGrid}>
          {movements.map((movement) => {
            const active = movement.id === movementId;
            const color = PATTERN_COLORS[movement.pattern];
            return (
              <Pressable
                key={movement.id}
                onPress={() => selectMovement(movement)}
                style={({ pressed }) => [
                  styles.movementTile,
                  compactTiles && styles.compactMovementTile,
                  {
                    backgroundColor: color,
                    borderColor: active ? colors.foreground : color,
                    borderWidth: active ? 3 : 1,
                    opacity: pressed ? 0.78 : active ? 1 : 0.84,
                  },
                ]}
              >
                <Text style={styles.movementName} numberOfLines={2}>
                  {movement.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.rirArea}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          REPS IN RESERVE · TAP TO LOG
        </Text>
        <View style={styles.rirRow}>
          {RIR_VALUES.map((value) => (
            <Pressable
              key={value}
              onPress={() => void commitSet(value)}
              disabled={!selected || isLogging}
              style={({ pressed }) => [
                styles.rirBtn,
                {
                  backgroundColor: selected ? colors.card : colors.secondary,
                  borderColor: selected ? patternColor : colors.border,
                  opacity: pressed ? 0.72 : selected ? 1 : 0.55,
                },
              ]}
            >
              <Text
                style={[
                  styles.rirBtnText,
                  { color: selected ? colors.foreground : colors.mutedForeground },
                ]}
              >
                {value === 4 ? '4+' : value}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  errorText: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  headerLabel: { fontSize: 11, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.4 },
  headerTotal: { fontSize: 34, fontFamily: 'Inter_700Bold', lineHeight: 39 },
  headerUnit: { fontSize: 16, fontFamily: 'Inter_500Medium' },
  loggedFlash: { fontSize: 15, fontFamily: 'Inter_600SemiBold', paddingBottom: 6 },
  repsBlock: {
    height: 78,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  stepBtn: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontSize: 31, fontFamily: 'Inter_500Medium', lineHeight: 36 },
  repsCenter: { width: 138, alignItems: 'center', justifyContent: 'center' },
  repsInput: {
    width: 138,
    height: 62,
    fontSize: 54,
    lineHeight: 60,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
    padding: 0,
  },
  repsLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: -7 },
  loadArea: { minHeight: 42, justifyContent: 'center' },
  addLoad: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addLoadText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  loadExpanded: { gap: 7 },
  loadModeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  loadModeBtn: {
    minWidth: 54,
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadModeText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  clearLoad: { marginLeft: 4, padding: 4 },
  poundsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  poundsInput: {
    minWidth: 82,
    height: 36,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    textAlign: 'center',
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
  },
  loadUnit: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  bandRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  bandBtn: {
    minHeight: 32,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bandBtnText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  noBands: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  movementArea: { marginTop: 7 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.25,
    marginBottom: 7,
  },
  movementGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  movementTile: {
    width: '48.8%',
    height: 52,
    borderRadius: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactMovementTile: { height: 44 },
  movementName: {
    color: '#141414',
    fontSize: 14,
    lineHeight: 17,
    fontFamily: 'Inter_700Bold',
    textAlign: 'center',
  },
  rirArea: { marginTop: 14 },
  rirRow: { flexDirection: 'row', gap: 8 },
  rirBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rirBtnText: { fontSize: 20, fontFamily: 'Inter_700Bold' },
});