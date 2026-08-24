import React, { useMemo } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { PATTERN_COLORS, PATTERN_LABELS } from '@/constants/patterns';
import { useTodaySets, useTraining } from '@/lib/store';
import { exportCsv } from '@/lib/csv';
import type { SetEntry } from '@/lib/types';

function timeOf(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function TodayScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { movements, sets } = useTraining();
  const todaySets = useTodaySets();
  const byId = useMemo(() => new Map(movements.map((m) => [m.id, m])), [movements]);

  const totalReps = todaySets.reduce((sum, s) => sum + s.reps, 0);

  const onExport = async () => {
    if (sets.length === 0) {
      Alert.alert('Nothing to export', 'Log a set first.');
      return;
    }
    try {
      await exportCsv(sets, movements);
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const renderItem = ({ item }: { item: SetEntry }) => {
    const m = byId.get(item.movementId);
    const c = m ? PATTERN_COLORS[m.pattern] : colors.mutedForeground;
    return (
      <Pressable
        onPress={() => router.push({ pathname: '/set/[id]', params: { id: item.id } })}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <View style={[styles.patternBar, { backgroundColor: c }]} />
        <View style={styles.rowBody}>
          <Text style={[styles.rowName, { color: colors.foreground }]} numberOfLines={1}>
            {m?.name ?? 'Unknown movement'}
          </Text>
          <Text style={[styles.rowMeta, { color: colors.mutedForeground }]}>
            {timeOf(item.performedAt)}
            {m ? ` · ${PATTERN_LABELS[m.pattern]}` : ''}
            {item.load ? ` · ${item.load} lb` : ''}
            {item.timestampEdited ? ' · edited' : ''}
          </Text>
        </View>
        <View style={styles.rowRight}>
          <Text style={[styles.rowReps, { color: colors.foreground }]}>{item.reps}</Text>
          <Text style={[styles.rowRir, { color: colors.mutedForeground }]}>
            RIR {item.rir === 4 ? '4+' : item.rir}
          </Text>
        </View>
      </Pressable>
    );
  };

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
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerLabel, { color: colors.mutedForeground }]}>TODAY</Text>
          <Text style={[styles.headerTotal, { color: colors.foreground }]}>
            {totalReps}{' '}
            <Text style={[styles.headerUnit, { color: colors.mutedForeground }]}>
              reps · {todaySets.length} {todaySets.length === 1 ? 'set' : 'sets'}
            </Text>
          </Text>
        </View>
        <Pressable
          onPress={onExport}
          hitSlop={8}
          style={({ pressed }) => [
            styles.exportBtn,
            { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="download" size={20} color={colors.foreground} />
        </Pressable>
      </View>

      <FlatList
        data={todaySets}
        keyExtractor={(s) => s.id}
        renderItem={renderItem}
        scrollEnabled={todaySets.length > 0}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Platform.OS === 'web' ? 100 : 96 },
        ]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="activity" size={32} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No sets yet today.{'\n'}Log one from the Log tab.
            </Text>
          </View>
        }
      />
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
    paddingBottom: 16,
  },
  headerLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', letterSpacing: 1.5 },
  headerTotal: { fontSize: 40, fontFamily: 'Inter_700Bold', lineHeight: 46 },
  headerUnit: { fontSize: 16, fontFamily: 'Inter_500Medium' },
  exportBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  listContent: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  patternBar: { width: 5, alignSelf: 'stretch' },
  rowBody: { flex: 1, paddingVertical: 12, paddingHorizontal: 14 },
  rowName: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  rowMeta: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 2 },
  rowRight: { alignItems: 'flex-end', paddingRight: 14 },
  rowReps: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  rowRir: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  empty: { alignItems: 'center', gap: 12, paddingTop: 80 },
  emptyText: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 22,
  },
});
