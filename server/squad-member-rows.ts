import MembersCollection from '../imports/api/collections/members.collection';
import PositionsCollection from '../imports/api/collections/positions.collection';
import RanksCollection from '../imports/api/collections/ranks.collection';
import type { SquadMemberRow } from '/imports/api/types';
import buildSquadMemberRows from '/imports/helpers/squads/buildSquadMemberRows';

/**
 * Loads a squad's direct members as sorted display rows (shared by `orbat.popover.items` and `squads.members`).
 * All ranks are loaded — not just the ones members hold — because seniority is derived from the whole rank chain.
 */
export default async function loadSquadMemberRows(squadId: string): Promise<SquadMemberRow[]> {
  const members = await MembersCollection.find(
    { 'profile.squadId': squadId },
    { fields: { 'profile.id': 1, 'profile.name': 1, 'profile.rankId': 1, 'profile.positionId': 1 } }
  ).fetchAsync();
  if (members.length === 0) return [];
  const positionIds = members.flatMap(m => (m.profile?.positionId ? [m.profile.positionId] : []));
  const [ranks, positions] = await Promise.all([
    RanksCollection.find({}, { fields: { name: 1, abbreviation: 1, color: 1, previousRankId: 1, nextRankId: 1 } }).fetchAsync(),
    positionIds.length > 0
      ? PositionsCollection.find({ _id: { $in: positionIds } }, { fields: { name: 1, color: 1, order: 1 } }).fetchAsync()
      : Promise.resolve([]),
  ]);
  return buildSquadMemberRows(members, ranks, positions);
}
