import React, { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { PATTERN_COLORS } from '@/constants/patterns';
import { useColors } from '@/hooks/useColors';
import { useTraining } from '@/lib/store';
import type { Load, SetEntry } from '@/lib/types';

const RIR_VALUES: SetEntry['rir'][] = [0, 1, 2, 3, 4];
type LoadMode = 'none' | 'pounds' | 'band';

function fmt(date: Date): string {
  return date.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function EditSetScreen() {
  const colors = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { ready, sets, movements, bands, updateSet, deleteSet } = useTraining();

  const set = useMemo(() => sets.find((entry) => entry.id === id) ?? null, [sets, id]);
  const movement = set
    ? movements.find((candidate) => candidate.id === set.movementId) ?? null
    : null;
  const bandChoices = useMemo(() => {
    const names = bands.map((band) => band.name);
    if (set?.load?.kind === 'band' && !names.includes(set.load.band)) names.push(set.load.band);
    return names;
  }, [bands, set]);

  const [reps, setReps] = useState(set ? String(set.reps) : '');
  const [loadMode, setLoadMode] = useState<LoadMode>(
    set?.load?.kind === 'pounds' ? 'pounds' : set?.load?.kind === 'band' ? 'band' : 'none',
  );
  const [poundsText, setPoundsText] = useState(
    set?.load?.kind === 'pounds' ? String(set.load.pounds) : '',
  );
  const [bandName, setBandName] = useState(set?.load?.kind === 'band' ? set.load.band : '');
  const [rir, setRir] = useState<SetEntry['rir']>(set?.rir ?? 2);
  const [performedAt, setPerformedAt] = useState(
    set ? new Date(set.performedAt) : new Date(),
  );
  const [timeChanged, setTimeChanged] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!ready) {
    return <View style={[styles.container, { backgroundColor: colors.background }]} />;
  }

  if (!set) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground, padding: 20 }}>Set not found.</Text>
      </View>
    );
  }

  const color = movement ? PATTERN_COLORS[movement.pattern] : colors.primary;

  const shiftTime = (minutes: number) => {
    setPerformedAt((date) => new Date(date.getTime() + minutes * 60_000));
    setTimeChanged(true);
  };

  const parsedLoad = (): Load | undefined | null => {
    if (loadMode === 'none') return undefined;
    if (loadMode === 'pounds') {
      const pounds = Number.parseFloat(poundsText);
      return Number.isFinite(pounds) && pounds > 0 ? { kind: 'pounds', pounds } : null;
    }
    return bandName ? { kind: 'band', band: bandName } : null;
  };

  const onSave = async () => {
    const parsedReps = Number.parseInt(reps, 10);
    if (!Number.isFinite(parsedReps) || parsedReps <= 0) {
      Alert.alert('Invalid reps', 'Reps must be a positive number.');
      return;
    }
    const load = parsedLoad();
    if (load === null) {
      Alert.alert(
        'Invalid load',
        loadMode === 'pounds'
          ? 'Enter a positive weight in pounds.'
          : 'Choose a resistance band.',
      );
      return;
    }

    setSaving(true);
    try {
      await updateSet(set.id, {
        reps: parsedReps,
        rir,
        load,
        ...(timeChanged ? { performedAt: performedAt.toISOString() } : {}),
      });
      router.back();
    } catch (cause) {
      Alert.alert(
        'Could not save set',
        cause instanceof Error ? cause.message : 'Unknown error',
      );
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    const performDelete = () => {
      void deleteSet(set.id)
        .then(() => router.back())
        .catch((cause: unknown) => {
          Alert.alert(
            'Could not delete set',
            cause instanceof Error ? cause.message : 'Unknown error',
          );
        });
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Delete set?\n\nThis cannot be undone.')) performDelete();
      return;
    }
    Alert.alert('Delete set?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: performDelete },
    ]);
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      bottomOffset={20}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.movementRow}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={[styles.movementName, { color: colors.foreground }]}>
          {movement?.name ?? 'Unknown movement'}
        </Text>
      </View>

      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>REPS</Text>
      <TextInput
        value={reps}
        onChangeText={(value) => setReps(value.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        style={[
          styles.repsInput,
          {
            color: colors.foreground,
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
        maxLength={3}
      />

      <Text style={[styles.fieldLabel, styles.loadLabel, { color: colors.mutedForeground }]}>
        LOAD
      </Text>
      <View style={styles.loadModeRow}>
        {(['none', 'pounds', 'band'] as const).map((mode) => {
          const active = loadMode === mode;
          return (
            <Pressable
              key={mode}
              onPress={() => setLoadMode(mode)}
              style={[
                styles.loadModeBtn,
                {
                  backgroundColor: active ? color : colors.card,
                  borderColor: active ? color : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.loadModeText,
                  { color: active ? '#141414' : colors.foreground },
                ]}
              >
                {mode === 'none' ? 'None' : mode === 'pounds' ? 'lb' : 'Band'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loadMode === 'pounds' && (
        <View style={styles.poundsRow}>
          <TextInput
            value={poundsText}
            onChangeText={(value) => setPoundsText(value.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
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
          <Text style={[styles.unit, { color: colors.mutedForeground }]}>lb</Text>
        </View>
      )}

      {loadMode === 'band' &&
        (bandChoices.length > 0 ? (
          <View style={styles.bandChoices}>
            {bandChoices.map((name) => {
              const active = bandName === name;
              return (
                <Pressable
                  key={name}
                  onPress={() => setBandName(name)}
                  style={[
                    styles.bandChoice,
                    {
                      backgroundColor: active ? color : colors.card,
                      borderColor: active ? color : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.bandChoiceText,
                      { color: active ? '#141414' : colors.foreground },
                    ]}
                  >
                    {name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={[styles.noBands, { color: colors.mutedForeground }]}>
            Add a band in Movements first.
          </Text>
        ))}

      <Text style={[styles.fieldLabel, styles.sectionLabel, { color: colors.mutedForeground }]}>
        REPS IN RESERVE
      </Text>
      <View style={styles.rirRow}>
        {RIR_VALUES.map((value) => {
          const active = rir === value;
          return (
            <Pressable
              key={value}
              onPress={() => setRir(value)}
              style={({ pressed }) => [
                styles.rirBtn,
                {
                  backgroundColor: active ? color : colors.card,
                  borderColor: active ? color : colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                style={[styles.rirText, { color: active ? '#141414' : colors.foreground }]}
              >
                {value === 4 ? '4+' : value}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.fieldLabel, styles.sectionLabel, { color: colors.mutedForeground }]}>
        PERFORMED AT
      </Text>
      <View
        style={[styles.timeCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Text style={[styles.timeText, { color: colors.foreground }]}>{fmt(performedAt)}</Text>
        {(timeChanged || set.timestampEdited) && (
          <Text style={[styles.editedTag, { color: colors.mutedForeground }]}>
            edited timestamp
          </Text>
        )}
        <View style={styles.timeBtns}>
          {[
            ['-1h', -60],
            ['-15m', -15],
            ['+15m', 15],
            ['+1h', 60],
          ].map(([label, minutes]) => (
            <Pressable
              key={label as string}
              onPress={() => shiftTime(minutes as number)}
              style={({ pressed }) => [
                styles.timeBtn,
                { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.timeBtnText, { color: colors.foreground }]}>
                {label as string}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable
        onPress={() => void onSave()}
        disabled={saving}
        style={({ pressed }) => [
          styles.saveBtn,
          { backgroundColor: saving ? colors.secondary : color, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text
          style={[
            styles.saveText,
            { color: saving ? colors.mutedForeground : '#141414' },
          ]}
        >
          Save changes
        </Text>
      </Pressable>
      <Pressable onPress={onDelete} style={styles.deleteBtn} hitSlop={8}>
        <Feather name="trash-2" size={16} color={colors.destructive} />
        <Text style={[styles.deleteText, { color: colors.destructive }]}>Delete set</Text>
      </Pressable>
      <View style={{ height: Platform.OS === 'web' ? 40 : 20 }} />
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20 },
  movementRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  movementName: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  fieldLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  repsInput: {
    width: 150,
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    textAlign: 'center',
  },
  loadLabel: { marginTop: 20 },
  loadModeRow: { flexDirection: 'row', gap: 8 },
  loadModeBtn: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadModeText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  poundsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  poundsInput: {
    width: 130,
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    textAlign: 'center',
  },
  unit: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  bandChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  bandChoice: {
    minHeight: 38,
    borderRadius: 19,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bandChoiceText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  noBands: { marginTop: 10, fontSize: 13, fontFamily: 'Inter_400Regular' },
  sectionLabel: { marginTop: 20 },
  rirRow: { flexDirection: 'row', gap: 8 },
  rirBtn: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rirText: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  timeCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  timeText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  editedTag: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  timeBtns: { flexDirection: 'row', gap: 8 },
  timeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  timeBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  saveBtn: {
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  saveText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
  },
  deleteText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});