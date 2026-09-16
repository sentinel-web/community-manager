import { Meteor } from 'meteor/meteor';
import MembersCollection from '../../imports/api/collections/members.collection';
import SquadsCollection from '../../imports/api/collections/squads.collection';
import { validateObject, validateString } from '../main';
import loadSquadMemberRows from '../squad-member-rows';
import type { OrbatSquad, SquadMemberRow } from '/imports/api/types';
import compareByOrderThenName from '/imports/helpers/sorting/compareByOrderThenName';

async function orbatPopoverItems(this: Meteor.MethodThisType, squadId: string = ''): Promise<SquadMemberRow[]> {
  validateString(this.userId, false);
  validateString(squadId, false);
  const squad = await SquadsCollection.findOneAsync(squadId);
  validateObject(squad, false);
  return loadSquadMemberRows(squadId);
}

// One aggregation for every node instead of a count request per ORBAT node.
async function countDirectMembersBySquad(squadIds: string[]): Promise<Map<string, number>> {
  if (squadIds.length === 0) return new Map();
  const pipeline = [{ $match: { 'profile.squadId': { $in: squadIds } } }, { $group: { _id: '$profile.squadId', count: { $sum: 1 } } }];
  // The driver's own generic types the result documents — no cast needed.
  const counts = await MembersCollection.rawCollection().aggregate<{ _id: string; count: number }>(pipeline).toArray();
  return new Map(counts.map(({ _id, count }) => [_id, count]));
}

async function orbatSquads(this: Meteor.MethodThisType): Promise<OrbatSquad[]> {
  validateString(this.userId, false);
  const squads = await SquadsCollection.find({ excludeFromOrbat: { $ne: true } }).fetchAsync();
  const memberCounts = await countDirectMembersBySquad(squads.flatMap(squad => (squad._id ? [squad._id] : [])));
  return squads.sort(compareByOrderThenName).map(squad => ({ ...squad, memberCount: (squad._id && memberCounts.get(squad._id)) || 0 }));
}

if (Meteor.isServer) {
  Meteor.methods({
    'orbat.popover.items': orbatPopoverItems,
    'orbat.squads': orbatSquads,
  });
}
