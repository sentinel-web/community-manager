import Fuse, { type IFuseOptions } from 'fuse.js';
import type { PaletteItem } from './palette.types';

const FUSE_OPTIONS: IFuseOptions<PaletteItem> = {
  keys: [{ name: 'label', weight: 1 }],
  threshold: 0.4,
  ignoreLocation: true,
  includeScore: true,
  isCaseSensitive: false,
  shouldSort: true,
  minMatchCharLength: 1,
};

const PREFIX_BOOST = 0.4;
const RECENCY_WEIGHT = 0.3;

export interface ScoreOptions {
  recencyBoost?: Map<string, number>;
}

export interface ScoredItem {
  item: PaletteItem;
  score: number;
}

export function scoreItems(query: string, items: PaletteItem[], options: ScoreOptions = {}): ScoredItem[] {
  const trimmed = query.trim();
  if (!trimmed) return items.map(item => ({ item, score: 0 }));

  const fuse = new Fuse(items, FUSE_OPTIONS);
  const lowerQuery = trimmed.toLowerCase();
  const recencyBoost = options.recencyBoost;

  const matches = fuse.search(trimmed);
  return matches.map(match => {
    let score = match.score ?? 1;
    const lowerLabel = match.item.label.toLowerCase();
    if (lowerLabel.startsWith(lowerQuery)) {
      score = Math.max(0, score - PREFIX_BOOST);
    }
    if (recencyBoost) {
      const boost = recencyBoost.get(`${match.item.kind}:${match.item.key}`);
      if (boost !== undefined) {
        score = Math.max(0, score - boost * RECENCY_WEIGHT);
      }
    }
    return { item: match.item, score };
  });
}
