import { Meteor } from 'meteor/meteor';
import MembersCollection from '../../imports/api/collections/members.collection';
import PositionsCollection from '../../imports/api/collections/positions.collection';
import RanksCollection from '../../imports/api/collections/ranks.collection';
import SquadsCollection from '../../imports/api/collections/squads.collection';
import { validateObject, validateString } from '../main';

async function orbatPopoverItems(squadId = '') {
  validateString(squadId, false);
  const squad = await SquadsCollection.findOneAsync(squadId);
  validateObject(squad, false);
  const members = await MembersCollection.find({ 'profile.squadId': squadId }).fetchAsync();
  const items = [];
  const ranks = await RanksCollection.find({ _id: { $in: members.map(m => m.profile.rankId) } }).mapAsync(r => ({ value: r._id, label: r.name }));
  const positionIds = members.map(m => m.profile?.positionId).filter(Boolean);
  const positions = positionIds.length > 0
    ? await PositionsCollection.find({ _id: { $in: positionIds } }).mapAsync(p => ({ value: p._id, label: p.name }))
    : [];
  for (const member of members) {
    const rankName = ranks.find(r => r.value === member.profile.rankId)?.label || '-';
    const positionName = member.profile?.positionId ? positions.find(p => p.value === member.profile.positionId)?.label : null;
    const label = positionName ? `${positionName} - ${rankName}` : rankName;
    items.push({
      label,
      children: `${member.profile.id} "${member.profile.name}"`,
    });
  }
  return items;
}

async function squadMembers(squadId = '') {
  validateString(this.userId, false);
  validateString(squadId, false);
  const members = await MembersCollection.find({ 'profile.squadId': squadId }).fetchAsync();
  if (members.length === 0) return [];
  const rankIds = members.map(m => m.profile.rankId).filter(Boolean);
  const positionIds = members.map(m => m.profile?.positionId).filter(Boolean);
  const ranks = rankIds.length > 0
    ? await RanksCollection.find({ _id: { $in: rankIds } }).fetchAsync()
    : [];
  const positions = positionIds.length > 0
    ? await PositionsCollection.find({ _id: { $in: positionIds } }).fetchAsync()
    : [];
  return members.map(m => {
    const rank = ranks.find(r => r._id === m.profile.rankId);
    const position = m.profile?.positionId ? positions.find(p => p._id === m.profile.positionId) : null;
    return {
      _id: m._id,
      name: m.profile.name,
      id: m.profile.id,
      rankName: rank?.name || null,
      rankColor: rank?.color || null,
      positionName: position?.name || null,
      positionColor: position?.color || null,
    };
  });
}

async function orbatSquads() {
  validateString(this.userId, false);
  const squads = await SquadsCollection.find({ excludeFromOrbat: { $ne: true } }).fetchAsync();
  return squads;
}

if (Meteor.isServer) {
  Meteor.methods({
    'orbat.popover.items': orbatPopoverItems,
    'orbat.squads': orbatSquads,
    'squads.members': squadMembers,
  });
}
