import type { PaletteItemKind } from './palette.types';

const STORAGE_KEY = 'cm.palette.recents';
const MAX_ENTRIES = 10;
const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
const HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000;

export interface RecentEntry {
  kind: PaletteItemKind;
  key: string;
  label: string;
  ts: number;
  count: number;
}

function isRecentEntry(value: unknown): value is RecentEntry {
  if (!value || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  return (
    (e.kind === 'navigate' || e.kind === 'action' || e.kind === 'entity') &&
    typeof e.key === 'string' &&
    typeof e.label === 'string' &&
    typeof e.ts === 'number' &&
    typeof e.count === 'number'
  );
}

function safeStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function frecencyScore(entry: { ts: number; count: number }, now: number = Date.now()): number {
  const recency = Math.exp(-(now - entry.ts) / HALF_LIFE_MS);
  return Math.log10(entry.count + 1) * recency;
}

export function readRecents(now: number = Date.now()): RecentEntry[] {
  const storage = safeStorage();
  if (!storage) return [];
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const fresh = parsed.filter(e => isRecentEntry(e) && now - e.ts < STALE_AFTER_MS);
    return fresh.sort((a, b) => frecencyScore(b, now) - frecencyScore(a, now)).slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

function writeRecents(entries: RecentEntry[]): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignored: localStorage may be full or disabled
  }
}

export function addRecent(entry: Omit<RecentEntry, 'ts' | 'count'>, now: number = Date.now()): RecentEntry[] {
  const existing = readRecents(now);
  const matchIdx = existing.findIndex(e => e.kind === entry.kind && e.key === entry.key);
  let next: RecentEntry[];
  if (matchIdx >= 0) {
    const merged: RecentEntry = { ...existing[matchIdx], label: entry.label, ts: now, count: existing[matchIdx].count + 1 };
    next = [merged, ...existing.slice(0, matchIdx), ...existing.slice(matchIdx + 1)];
  } else {
    next = [{ ...entry, ts: now, count: 1 }, ...existing];
  }
  next = next.sort((a, b) => frecencyScore(b, now) - frecencyScore(a, now)).slice(0, MAX_ENTRIES);
  writeRecents(next);
  return next;
}

export function removeRecent(kind: PaletteItemKind, key: string): RecentEntry[] {
  const existing = readRecents();
  const next = existing.filter(e => !(e.kind === kind && e.key === key));
  writeRecents(next);
  return next;
}
