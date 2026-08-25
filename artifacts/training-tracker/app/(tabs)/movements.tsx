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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { PATTERN_COLORS, PATTERN_LABELS, PATTERNS, type Pattern } from '@/constants/patterns';
import { useColors } from '@/hooks/useColors';
import { useTraining } from '@/lib/store';
import { formatLoad, type Load, type Movement, type ResistanceBand } from '@/lib/types';

type DefaultMode = 'none' | 'pounds' | 'band';

export default function MovementsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    movements,
    sets,
    bands,
    addMovement,
    deleteMovement,
    updateMovementDefaultLoad,
    addBand,
    deleteBand,
  } = useTraining();

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [pattern, setPattern] = useState<Pattern | null>(null);
  const [newBandName, setNewBandName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [defaultMode, setDefaultMode] = useState<DefaultMode>('none');
  const [defaultPounds, setDefaultPounds] = useState('');
  const [defaultBand, setDefaultBand] = useState('');
  const [saving, setSaving] = useState(false);

  const setCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const set of sets) {
      counts.set(set.movementId, (counts.get(set.movementId) ?? 0) + 1);
    }
    return counts;
  }, [sets]);

  const onAddMovement = async () => {
    if (!name.trim() || !pattern || saving) return;
    setSaving(true);
    try {
      const created = await addMovement(name, pattern);
      if (created) {
        setName('');
        setPattern(null);
        setAdding(false);
      }
    } catch (cause) {
      Alert.alert(
        'Could not add movement',
        cause instanceof Error ? cause.message : 'Unknown error',
      );
    } finally {
      setSaving(false);
    }
  };

  const onAddBand = async () => {
    if (!newBandName.trim() || saving) return;
    setSaving(true);
    try {
      const created = await addBand(newBandName);
      if (created) setNewBandName('');
    } catch (cause) {
      Alert.alert(
        'Could not add band',
        cause instanceof Error && cause.message.includes('UNIQUE')
          ? 'A band with that name already exists.'
          : cause instanceof Error
            ? cause.message
            : 'Unknown error',
      );
    } finally {
      setSaving(false);
    }
  };

  const onDeleteMovement = (movement: Movement) => {
    const count = setCounts.get(movement.id) ?? 0;
    if (count > 0) {
      Alert.alert(
        'Movement in use',
        `${movement.name} has ${count} logged ${count === 1 ? 'set' : 'sets'}. Movements with history can't be deleted.`,
      );
      return;
    }
    const performDelete = () => {
      void deleteMovement(movement.id).catch((cause: unknown) => {
        Alert.alert(
          'Could not delete movement',
          cause instanceof Error ? cause.message : 'Unknown error',
        );
      });
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete movement?\n\n${movement.name}`)) performDelete();
      return;
    }
    Alert.alert('Delete movement?', movement.name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: performDelete },
    ]);
  };

  const onDeleteBand = (band: ResistanceBand) => {
    const defaultUsers = movements.filter(
      (movement) =>
        movement.defaultLoad?.kind === 'band' &&
        movement.defaultLoad.band.toLocaleLowerCase() === band.name.toLocaleLowerCase(),
    );
    if (defaultUsers.length > 0) {
      Alert.alert(
        'Band is a default',
        `Change the default load for ${defaultUsers.map((movement) => movement.name).join(', ')} before deleting ${band.name}.`,
      );
      return;
    }
    const message = `${band.name} will disappear from the load picker. Past sets keep their saved load.`;
    const performDelete = () => {
      void deleteBand(band.id)
        .then((deleted) => {
          if (!deleted) Alert.alert('Band is in use', 'Change movement defaults first.');
        })
        .catch((cause: unknown) => {
          Alert.alert(
            'Could not delete band',
            cause instanceof Error ? cause.message : 'Unknown error',
          );
        });
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete band?\n\n${message}`)) performDelete();
      return;
    }
    Alert.alert('Delete band?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: performDelete },
    ]);
  };

  const openDefaultEditor = (movement: Movement) => {
    if (editingId === movement.id) {
      setEditingId(null);
      return;
    }
    setEditingId(movement.id);
    if (movement.defaultLoad?.kind === 'pounds') {
      setDefaultMode('pounds');
      setDefaultPounds(String(movement.defaultLoad.pounds));
      setDefaultBand('');
    } else if (movement.defaultLoad?.kind === 'band') {
      setDefaultMode('band');
      setDefaultBand(movement.defaultLoad.band);
      setDefaultPounds('');
    } else {
      setDefaultMode('none');
      setDefaultPounds('');
      setDefaultBand('');
    }
  };

  const saveDefault = async (movement: Movement) => {
    let load: Load | undefined;
    if (defaultMode === 'pounds') {
      const pounds = Number.parseFloat(defaultPounds);
      if (!Number.isFinite(pounds) || pounds <= 0) {
        Alert.alert('Invalid load', 'Enter a positive weight in pounds.');
        return;
      }
      load = { kind: 'pounds', pounds };
    } else if (defaultMode === 'band') {
      if (!defaultBand) {
        Alert.alert('Choose a band', 'Add or select a resistance band first.');
        return;
      }
      load = { kind: 'band', band: defaultBand };
    }

    setSaving(true);
    try {
      await updateMovementDefaultLoad(movement.id, load);
      setEditingId(null);
    } catch (cause) {
      Alert.alert(
        'Could not save default',
        cause instanceof Error ? cause.message : 'Unknown error',
      );
    } finally {
      setSaving(false);
    }
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
          onPress={() => setAdding((value) => !value)}
          hitSlop={8}
          style={({ pressed }) => [
            styles.addBtn,
            {
              backgroundColor: adding ? colors.secondary : colors.primary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Feather
            name={adding ? 'x' : 'plus'}
            size={20}
            color={adding ? colors.foreground : colors.primaryForeground}
          />
        </Pressable>
      </View>

      <KeyboardAwareScrollViewCompat
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Platform.OS === 'web' ? 104 : 96 },
        ]}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        {adding && (
          <View
            style={[styles.card, styles.addCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>New movement</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Movement name"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.textInput,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
              autoFocus
              returnKeyType="done"
            />
            <View style={styles.patternGrid}>
              {PATTERNS.map((value) => {
                const active = pattern === value;
                const color = PATTERN_COLORS[value];
                return (
                  <Pressable
                    key={value}
                    onPress={() => setPattern(value)}
                    style={({ pressed }) => [
                      styles.patternChip,
                      {
                        backgroundColor: active ? color : colors.background,
                        borderColor: active ? color : colors.border,
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
                      {PATTERN_LABELS[value]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={() => void onAddMovement()}
              disabled={!name.trim() || !pattern || saving}
              style={({ pressed }) => [
                styles.saveBtn,
                {
                  backgroundColor:
                    name.trim() && pattern && !saving ? colors.primary : colors.secondary,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.saveBtnText,
                  {
                    color:
                      name.trim() && pattern && !saving
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

        <View
          style={[styles.card, styles.bandCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Resistance bands</Text>
          <Text style={[styles.cardHelp, { color: colors.mutedForeground }]}>
            Name each band once, then choose it as a load or movement default.
          </Text>
          <View style={styles.bandAddRow}>
            <TextInput
              value={newBandName}
              onChangeText={setNewBandName}
              placeholder="Band name"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.textInput,
                styles.bandInput,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
              returnKeyType="done"
              onSubmitEditing={() => void onAddBand()}
            />
            <Pressable
              onPress={() => void onAddBand()}
              disabled={!newBandName.trim() || saving}
              style={[
                styles.squareAdd,
                {
                  backgroundColor:
                    newBandName.trim() && !saving ? colors.primary : colors.secondary,
                },
              ]}
            >
              <Feather
                name="plus"
                size={20}
                color={
                  newBandName.trim() && !saving
                    ? colors.primaryForeground
                    : colors.mutedForeground
                }
              />
            </Pressable>
          </View>
          {bands.length > 0 ? (
            <View style={styles.bandList}>
              {bands.map((band) => (
                <View
                  key={band.id}
                  style={[
                    styles.bandChip,
                    { backgroundColor: colors.background, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.bandChipText, { color: colors.foreground }]}>
                    {band.name}
                  </Text>
                  <Pressable onPress={() => onDeleteBand(band)} hitSlop={6}>
                    <Feather name="x" size={14} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.emptyBands, { color: colors.mutedForeground }]}>
              No bands defined.
            </Text>
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
          MOVEMENT DEFAULTS
        </Text>
        {movements.map((movement) => {
          const color = PATTERN_COLORS[movement.pattern];
          const count = setCounts.get(movement.id) ?? 0;
          const editing = editingId === movement.id;
          return (
            <View
              key={movement.id}
              style={[styles.card, styles.movementCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.patternBar, { backgroundColor: color }]} />
              <View style={styles.movementMain}>
                <Pressable
                  onPress={() => openDefaultEditor(movement)}
                  style={({ pressed }) => [styles.rowBody, { opacity: pressed ? 0.72 : 1 }]}
                >
                  <View style={styles.rowHeading}>
                    <Text
                      style={[styles.rowName, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {movement.name}
                    </Text>
                    <Feather
                      name={editing ? 'chevron-up' : 'chevron-down'}
                      size={17}
                      color={colors.mutedForeground}
                    />
                  </View>
                  <Text style={[styles.rowMeta, { color: colors.mutedForeground }]}>
                    <Text style={{ color }}>{PATTERN_LABELS[movement.pattern]}</Text>
                    {` · ${count} ${count === 1 ? 'set' : 'sets'}`}
                  </Text>
                  <Text style={[styles.defaultSummary, { color: colors.foreground }]}>
                    Default · {movement.defaultLoad ? formatLoad(movement.defaultLoad) : 'none'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => onDeleteMovement(movement)}
                  hitSlop={10}
                  style={styles.deleteBtn}
                >
                  <Feather name="trash-2" size={18} color={colors.mutedForeground} />
                </Pressable>
              </View>

              {editing && (
                <View style={[styles.defaultEditor, { borderTopColor: colors.border }]}>
                  <View style={styles.modeRow}>
                    {(['none', 'pounds', 'band'] as const).map((mode) => {
                      const active = defaultMode === mode;
                      return (
                        <Pressable
                          key={mode}
                          onPress={() => setDefaultMode(mode)}
                          style={[
                            styles.modeBtn,
                            {
                              backgroundColor: active ? color : colors.background,
                              borderColor: active ? color : colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.modeText,
                              { color: active ? '#141414' : colors.foreground },
                            ]}
                          >
                            {mode === 'none' ? 'None' : mode === 'pounds' ? 'lb' : 'Band'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {defaultMode === 'pounds' && (
                    <View style={styles.defaultPoundsRow}>
                      <TextInput
                        value={defaultPounds}
                        onChangeText={(value) =>
                          setDefaultPounds(value.replace(/[^0-9.]/g, ''))
                        }
                        placeholder="0"
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="decimal-pad"
                        style={[
                          styles.textInput,
                          styles.defaultPoundsInput,
                          {
                            color: colors.foreground,
                            borderColor: colors.border,
                            backgroundColor: colors.background,
                          },
                        ]}
                      />
                      <Text style={[styles.unit, { color: colors.mutedForeground }]}>lb</Text>
                    </View>
                  )}

                  {defaultMode === 'band' &&
                    (bands.length > 0 ? (
                      <View style={styles.bandList}>
                        {bands.map((band) => {
                          const active = defaultBand === band.name;
                          return (
                            <Pressable
                              key={band.id}
                              onPress={() => setDefaultBand(band.name)}
                              style={[
                                styles.bandChoice,
                                {
                                  backgroundColor: active ? color : colors.background,
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
                                {band.name}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : (
                      <Text style={[styles.emptyBands, { color: colors.mutedForeground }]}>
                        Add a band above first.
                      </Text>
                    ))}

                  <Pressable
                    onPress={() => void saveDefault(movement)}
                    disabled={saving}
                    style={[
                      styles.defaultSave,
                      { backgroundColor: saving ? colors.secondary : color },
                    ]}
                  >
                    <Text
                      style={[
                        styles.defaultSaveText,
                        { color: saving ? colors.mutedForeground : '#141414' },
                      ]}
                    >
                      Save default
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  scroll: { flex: 1 },
  content: { gap: 10 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 14,
  },
  headerTitle: { fontSize: 28, fontFamily: 'Inter_700Bold' },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { borderRadius: 16, borderWidth: 1 },
  addCard: { padding: 14, gap: 12 },
  cardTitle: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  cardHelp: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter_400Regular' },
  textInput: {
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
  bandCard: { padding: 14, gap: 10 },
  bandAddRow: { flexDirection: 'row', gap: 8 },
  bandInput: { flex: 1 },
  squareAdd: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bandList: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  bandChip: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 11,
  },
  bandChipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  emptyBands: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  sectionTitle: {
    marginTop: 5,
    marginBottom: 1,
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.3,
  },
  movementCard: { overflow: 'hidden' },
  patternBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  movementMain: { flexDirection: 'row', alignItems: 'center', marginLeft: 5 },
  rowBody: { flex: 1, paddingVertical: 12, paddingHorizontal: 14 },
  rowHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowName: { flex: 1, fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  rowMeta: { fontSize: 13, fontFamily: 'Inter_500Medium', marginTop: 2 },
  defaultSummary: { fontSize: 13, fontFamily: 'Inter_600SemiBold', marginTop: 5 },
  deleteBtn: { paddingHorizontal: 14, paddingVertical: 20 },
  defaultEditor: {
    marginLeft: 5,
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  modeRow: { flexDirection: 'row', gap: 7 },
  modeBtn: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  defaultPoundsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  defaultPoundsInput: { width: 110, textAlign: 'center' },
  unit: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  bandChoice: {
    minHeight: 34,
    borderWidth: 1,
    borderRadius: 17,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bandChoiceText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  defaultSave: {
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultSaveText: { fontSize: 14, fontFamily: 'Inter_700Bold' },
});