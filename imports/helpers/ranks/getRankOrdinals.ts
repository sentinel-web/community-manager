export interface RankChainLink {
  _id?: string;
  previousRankId?: string;
  nextRankId?: string;
}

/** Code-point comparison (not locale-dependent) so the sort is stable across environments. */
function compareIds(a: string = '', b: string = ''): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Derives a seniority ordinal from the `previousRankId`/`nextRankId` chain for every rank that takes part in it.
 * The highest rank of a chain gets `0`, the one below it `1`, and so on — sort ascending for "highest rank first".
 *
 * - A `nextRankId` link wins; a lone `previousRankId` back-link repairs a missing forward link. The repair is
 *   applied in `_id` order so a malformed chain with several candidates still yields the same map every run.
 * - Links to unknown ranks and self-links are ignored.
 * - A rank left with no surviving link at all (an unchained rank) gets **no** ordinal rather than `0`, so it
 *   does not masquerade as the top of the chain; callers fall back to another sort key for it.
 * - Ranks inside (or leading into) a cycle likewise get no ordinal.
 * - Separate chains (e.g. player vs. zeus ranks) are numbered independently from their own top.
 */
export default function getRankOrdinals(ranks: readonly RankChainLink[]): Map<string, number> {
  // Deterministic order: the repair pass below is first-writer-wins, so an unsorted input
  // (e.g. an unordered `find({})`) could otherwise produce different ordinals between runs.
  const ordered = [...ranks].sort((a, b) => compareIds(a._id, b._id));
  const ids = new Set(ordered.flatMap(rank => (rank._id ? [rank._id] : [])));
  const next = new Map<string, string>();
  for (const rank of ordered) {
    if (rank._id && rank.nextRankId && rank.nextRankId !== rank._id && ids.has(rank.nextRankId)) {
      next.set(rank._id, rank.nextRankId);
    }
  }
  for (const rank of ordered) {
    const previous = rank.previousRankId;
    if (rank._id && previous && previous !== rank._id && ids.has(previous) && !next.has(previous)) {
      next.set(previous, rank._id);
    }
  }

  // Only ranks on at least one surviving link are ranked; the rest stay ordinal-less.
  const linked = new Set<string>([...next.keys(), ...next.values()]);

  const ordinals = new Map<string, number>();
  const cyclic = new Set<string>();
  for (const id of linked) {
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
