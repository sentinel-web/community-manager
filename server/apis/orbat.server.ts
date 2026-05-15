import { Meteor } from 'meteor/meteor';
import MembersCollection from '../../imports/api/collections/members.collection';
import PositionsCollection from '../../imports/api/collections/positions.collection';
import RanksCollection from '../../imports/api/collections/ranks.collection';
import SquadsCollection from '../../imports/api/collections/squads.collection';
import { validateObject, validateString } from '../main';
import type { Squad } from '/imports/api/types';

interface OrbatPopoverItem {
  label: string;
  children: string;
}

async function orbatPopoverItems(squadId: string = ''): Promise<OrbatPopoverItem[]> {
  validateString(squadId, false);
  const squad = await SquadsCollection.findOneAsync(squadId);
  validateObject(squad, false);
  const members = await MembersCollection.find({ 'profile.squadId': squadId }).fetchAsync();
  const items: OrbatPopoverItem[] = [];
  const rankIds = members.flatMap(m => m.profile?.rankId ? [m.profile.rankId] : []);
  const ranks = await RanksCollection.find({ _id: { $in: rankIds } }).mapAsync(r => ({ value: r._id, label: r.name }));
  const positionIds = members.flatMap(m => m.profile?.positionId ? [m.profile.positionId] : []);
  const positions = positionIds.length > 0
    ? await PositionsCollection.find({ _id: { $in: positionIds } }).mapAsync(p => ({ value: p._id, label: p.name }))
    : [];
  const rankLabelById = new Map(ranks.map(r => [r.value, r.label]));
  const positionLabelById = new Map(positions.map(p => [p.value, p.label]));
  for (const member of members) {
    const rankName = (member.profile?.rankId ? rankLabelById.get(member.profile.rankId) : undefined) || '-';
    const positionName = member.profile?.positionId ? positionLabelById.get(member.profile.positionId) : null;
    const label = positionName ? `${positionName} - ${rankName}` : rankName;
    items.push({
      label,
      children: `${member.profile?.id} "${member.profile?.name}"`,
    });
  }
  return items;
}

async function orbatSquads(this: { userId: string | null }): Promise<Squad[]> {
  validateString(this.userId, false);
  const squads = await SquadsCollection.find({ excludeFromOrbat: { $ne: true } }).fetchAsync();
  return squads;
}

if (Meteor.isServer) {
  Meteor.methods({
    'orbat.popover.items': orbatPopoverItems,
    'orbat.squads': orbatSquads,
  });
}
