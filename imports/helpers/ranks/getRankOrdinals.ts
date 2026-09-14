export interface RankChainLink {
  _id?: string;
  previousRankId?: string;
  nextRankId?: string;
}

/**
 * Derives a seniority ordinal for every rank from the `previousRankId`/`nextRankId` chain.
 * The highest rank of a chain gets `0`, the one below it `1`, and so on — sort ascending for "highest rank first".
 *
 * - A `nextRankId` link wins; a lone `previousRankId` back-link repairs a missing forward link.
 * - Links to unknown ranks and self-links are ignored.
 * - Ranks inside (or leading into) a cycle get no ordinal, so callers can fall back to another sort key.
 * - Separate chains (e.g. player vs. zeus ranks) are numbered independently from their own top.
 */
export default function getRankOrdinals(ranks: readonly RankChainLink[]): Map<string, number> {
  const ids = new Set(ranks.flatMap(rank => (rank._id ? [rank._id] : [])));
  const next = new Map<string, string>();
  for (const rank of ranks) {
    if (rank._id && rank.nextRankId && rank.nextRankId !== rank._id && ids.has(rank.nextRankId)) {
      next.set(rank._id, rank.nextRankId);
    }
  }
  for (const rank of ranks) {
    const previous = rank.previousRankId;
    if (rank._id && previous && previous !== rank._id && ids.has(previous) && !next.has(previous)) {
      next.set(previous, rank._id);
    }
  }

  const ordinals = new Map<string, number>();
  const cyclic = new Set<string>();
  for (const id of ids) {
    const path: string[] = [];
    const onPath = new Set<string>();
    let current: string | undefined = id;
    let ordinal = 0;
    let broken = false;
    while (current !== undefined) {
      const known = ordinals.get(current);
      if (known !== undefined) {
        ordinal = known + 1;
        break;
      }
      if (cyclic.has(current) || onPath.has(current)) {
        broken = true;
        break;
      }
      path.push(current);
      onPath.add(current);
      current = next.get(current);
    }
    for (let i = path.length - 1; i >= 0; i--) {
      if (broken) {
        cyclic.add(path[i]);
      } else {
        ordinals.set(path[i], ordinal++);
      }
    }
  }
  return ordinals;
}
