import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { PATTERN_COLORS, PATTERN_LABELS, PATTERNS, Pattern } from '@/constants/patterns';
import { useTraining } from '@/lib/store';
import type { Movement } from '@/lib/types';

export default function MovementsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { movements, sets, addMovement, deleteMovement } = useTraining();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [pattern, setPattern] = useState<Pattern | null>(null);

  const setCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sets) counts.set(s.movementId, (counts.get(s.movementId) ?? 0) + 1);
    return counts;
  }, [sets]);

  const onAdd = () => {
    if (!name.trim() || !pattern) return;
    const created = addMovement(name, pattern);
    if (created) {
      setName('');
      setPattern(null);
      setAdding(false);
    }
  };

  const onDelete = (m: Movement) => {
    const count = setCounts.get(m.id) ?? 0;
    if (count > 0) {
      Alert.alert(
        'Movement in use',
        `${m.name} has ${count} logged ${count === 1 ? 'set' : 'sets'}. Movements with history can't be deleted.`,
      );
      return;
    }
    Alert.alert('Delete movement?', m.name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMovement(m.id) },
    ]);
  };

  const renderItem = ({ item }: { item: Movement }) => {
    const c = PATTERN_COLORS[item.pattern];
    const count = setCounts.get(item.id) ?? 0;
    return (
      <View
        style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={[styles.patternBar, { backgroundColor: c }]} />
        <View style={styles.rowBody}>
          <Text style={[styles.rowName, { color: colors.foreground }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.rowMeta, { color: colors.mutedForeground }]}>
            <Text style={{ color: c }}>{PATTERN_LABELS[item.pattern]}</Text>
            {` · ${count} ${count === 1 ? 'set' : 'sets'}`}
          </Text>
        </View>
        <Pressable onPress={() => onDelete(item)} hitSlop={10} style={styles.deleteBtn}>
          <Feather name="trash-2" size={18} color={colors.mutedForeground} />
        </Pressable>
      </View>
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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Movements</Text>
        <Pressable
          onPress={() => setAdding((v) => !v)}
          hitSlop={8}
          style={({ pressed }) => [
            styles.addBtn,
            { backgroundColor: adding ? colors.secondary : colors.primary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Feather
            name={adding ? 'x' : 'plus'}
            size={20}
            color={adding ? colors.foreground : colors.primaryForeground}
          />
        </Pressable>
      </View>

      {adding && (
        <View
          style={[styles.addCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Movement name"
            placeholderTextColor={colors.mutedForeground}
            style={[
              styles.nameInput,
              { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background },
            ]}
            autoFocus
            returnKeyType="done"
          />
          <View style={styles.patternGrid}>
            {PATTERNS.map((p) => {
              const active = pattern === p;
              const c = PATTERN_COLORS[p];
              return (
                <Pressable
                  key={p}
                  onPress={() => setPattern(p)}
                  style={({ pressed }) => [
                    styles.patternChip,
                    {
                      backgroundColor: active ? c : colors.background,
                      borderColor: active ? c : colors.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.patternChipText,
                      { color: active ? '#141414' : colors.foreground },
                    ]}
                  >
                    {PATTERN_LABELS[p]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            onPress={onAdd}
            disabled={!name.trim() || !pattern}
            style={({ pressed }) => [
              styles.saveBtn,
              {
                backgroundColor:
                  name.trim() && pattern ? colors.primary : colors.secondary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.saveBtnText,
                {
                  color:
                    name.trim() && pattern
                      ? colors.primaryForeground
                      : colors.mutedForeground,
                },
              ]}
            >
              Add movement
            </Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={movements}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        scrollEnabled={movements.length > 0}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Platform.OS === 'web' ? 100 : 96 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTitle: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 14, gap: 12 },
  nameInput: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  patternGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  patternChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  patternChipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  saveBtn: { height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
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
  rowMeta: { fontSize: 13, fontFamily: 'Inter_500Medium', marginTop: 2 },
  deleteBtn: { paddingHorizontal: 14 },
});
