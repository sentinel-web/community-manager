import type { SquadMemberRow } from '../../api/types/orbat';
import getRankOrdinals, { type RankChainLink } from '../ranks/getRankOrdinals';
import { compareOptionalNumbers } from '../sorting/compareByOrderThenName';

export interface SquadMemberSource {
  _id: string;
  profile?: { id?: number; name?: string; rankId?: string; positionId?: string };
}

export interface SquadMemberRankSource extends RankChainLink {
  name: string;
  abbreviation?: string | null;
  color?: string | null;
}

export interface SquadMemberPositionSource {
  _id?: string;
  name: string;
  color?: string | null;
  order?: number | null;
}

/**
 * Resolves squad members into display rows and sorts them by position order (missing last), then rank
 * seniority (missing last), then name. `ranks` must hold the whole rank chain, not only the ranks the
 * members hold, so seniority can be derived from `previousRankId`/`nextRankId`.
 */
export default function buildSquadMemberRows(
  members: readonly SquadMemberSource[],
  ranks: readonly SquadMemberRankSource[],
  positions: readonly SquadMemberPositionSource[]
): SquadMemberRow[] {
  const rankById = new Map(ranks.flatMap(rank => (rank._id ? [[rank._id, rank] as const] : [])));
  const positionById = new Map(positions.flatMap(position => (position._id ? [[position._id, position] as const] : [])));
  const rankOrdinals = getRankOrdinals(ranks);

  const entries = members.map(member => {
    const profile = member.profile ?? {};
    const rank = profile.rankId ? rankById.get(profile.rankId) : undefined;
    const position = profile.positionId ? positionById.get(profile.positionId) : undefined;
    const row: SquadMemberRow = {
      memberId: member._id,
      memberNumber: profile.id ?? null,
      memberName: profile.name ?? null,
      positionName: position?.name || null,
      positionColor: position?.color || null,
      rankName: rank?.name || null,
      rankAbbreviation: rank?.abbreviation || null,
      rankColor: rank?.color || null,
    };
    return {
      row,
      positionOrder: position?.order,
      rankOrdinal: rank?._id ? rankOrdinals.get(rank._id) : undefined,
    };
  });

  entries.sort(
    (a, b) =>
      compareOptionalNumbers(a.positionOrder, b.positionOrder) ||
      compareOptionalNumbers(a.rankOrdinal, b.rankOrdinal) ||
      (a.row.memberName ?? '').localeCompare(b.row.memberName ?? '') ||
      compareOptionalNumbers(a.row.memberNumber, b.row.memberNumber)
  );
  return entries.map(entry => entry.row);
}
