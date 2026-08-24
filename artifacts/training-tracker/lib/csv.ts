import { Platform, Share } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import type { Movement, SetEntry } from '@/lib/types';

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return '"' + value.replace(/"/g, '""') + '"';
  return value;
}

/** Every raw set row, all fields, no summaries. */
export function buildCsv(sets: SetEntry[], movements: Movement[]): string {
  const byId = new Map(movements.map((m) => [m.id, m]));
  const header = [
    'id',
    'movement_id',
    'movement_name',
    'pattern',
    'reps',
    'load_lb',
    'rir',
    'performed_at',
    'logged_at',
    'heavy',
    'timestamp_edited',
  ];
  const rows = [...sets]
    .sort((a, b) => a.performedAt.localeCompare(b.performedAt))
    .map((s) => {
      const m = byId.get(s.movementId);
      return [
        s.id,
        s.movementId,
        csvEscape(m?.name ?? ''),
        csvEscape(m?.pattern ?? ''),
        String(s.reps),
        s.load != null ? String(s.load) : '',
        String(s.rir),
        s.performedAt,
        s.loggedAt,
        String(s.heavy),
        String(s.timestampEdited),
      ].join(',');
    });
  return [header.join(','), ...rows].join('\n');
}

export async function exportCsv(sets: SetEntry[], movements: Movement[]): Promise<void> {
  const csv = buildCsv(sets, movements);
  const filename = `training-sets-${new Date().toISOString().slice(0, 10)}.csv`;

  if (Platform.OS === 'web') {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await Share.share(
    Platform.OS === 'ios' ? { url: uri } : { message: csv, title: filename },
  );
}
