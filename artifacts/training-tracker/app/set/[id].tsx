import React, { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { PATTERN_COLORS } from '@/constants/patterns';
import { useTraining } from '@/lib/store';
import type { SetEntry } from '@/lib/types';

const RIR_VALUES: SetEntry['rir'][] = [0, 1, 2, 3, 4];

function fmt(dt: Date): string {
  return dt.toLocaleString([], {
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
  const { sets, movements, updateSet, deleteSet } = useTraining();

  const set = useMemo(() => sets.find((s) => s.id === id) ?? null, [sets, id]);
  const movement = set ? movements.find((m) => m.id === set.movementId) : null;

  const [reps, setReps] = useState<string>(set ? String(set.reps) : '');
  const [load, setLoad] = useState<string>(set?.load ? String(set.load) : '');
  const [rir, setRir] = useState<SetEntry['rir']>(set?.rir ?? 2);
  const [performedAt, setPerformedAt] = useState<Date>(
    set ? new Date(set.performedAt) : new Date(),
  );
  const [timeChanged, setTimeChanged] = useState(false);

  if (!set) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.mutedForeground, padding: 20 }}>Set not found.</Text>
      </View>
    );
  }

  const c = movement ? PATTERN_COLORS[movement.pattern] : colors.primary;

  const shiftTime = (minutes: number) => {
    setPerformedAt((d) => new Date(d.getTime() + minutes * 60_000));
    setTimeChanged(true);
  };

  const onSave = () => {
    const parsedReps = parseInt(reps, 10);
    if (!Number.isFinite(parsedReps) || parsedReps <= 0) {
      Alert.alert('Invalid reps', 'Reps must be a positive number.');
      return;
    }
    const parsedLoad = parseFloat(load);
    updateSet(set.id, {
      reps: parsedReps,
      rir,
      load: Number.isFinite(parsedLoad) && parsedLoad > 0 ? parsedLoad : undefined,
      ...(timeChanged ? { performedAt: performedAt.toISOString() } : {}),
    });
    router.back();
  };

  const onDelete = () => {
    Alert.alert('Delete set?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteSet(set.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Movement */}
      <View style={styles.movementRow}>
        <View style={[styles.dot, { backgroundColor: c }]} />
        <Text style={[styles.movementName, { color: colors.foreground }]}>
          {movement?.name ?? 'Unknown movement'}
        </Text>
      </View>

      {/* Reps + load */}
      <View style={styles.fieldRow}>
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>REPS</Text>
          <TextInput
            value={reps}
            onChangeText={(t) => setReps(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            style={[
              styles.fieldInput,
              { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border },
            ]}
            maxLength={3}
          />
        </View>
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>LOAD (LB)</Text>
          <TextInput
            value={load}
            onChangeText={(t) => setLoad(t.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.fieldInput,
              { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border },
            ]}
            maxLength={5}
          />
        </View>
      </View>

      {/* RIR */}
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 20 }]}>
        REPS IN RESERVE
      </Text>
      <View style={styles.rirRow}>
        {RIR_VALUES.map((v) => {
          const active = rir === v;
          return (
            <Pressable
              key={v}
              onPress={() => setRir(v)}
              style={({ pressed }) => [
                styles.rirBtn,
                {
                  backgroundColor: active ? c : colors.card,
                  borderColor: active ? c : colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                style={[styles.rirText, { color: active ? '#141414' : colors.foreground }]}
              >
                {v === 4 ? '4+' : v}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Time */}
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 20 }]}>
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
          ].map(([label, mins]) => (
            <Pressable
              key={label as string}
              onPress={() => shiftTime(mins as number)}
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

      {/* Save / delete */}
      <Pressable
        onPress={onSave}
        style={({ pressed }) => [
          styles.saveBtn,
          { backgroundColor: c, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <Text style={[styles.saveText, { color: '#141414' }]}>Save changes</Text>
      </Pressable>
      <Pressable onPress={onDelete} style={styles.deleteBtn} hitSlop={8}>
        <Feather name="trash-2" size={16} color={colors.destructive} />
        <Text style={[styles.deleteText, { color: colors.destructive }]}>Delete set</Text>
      </Pressable>
      <View style={{ height: Platform.OS === 'web' ? 40 : 20 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20 },
  movementRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  movementName: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  fieldRow: { flexDirection: 'row', gap: 12 },
  field: { flex: 1 },
  fieldLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  fieldInput: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlign: 'center',
  },
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
