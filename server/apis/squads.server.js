import { Meteor } from 'meteor/meteor';
import MembersCollection from '../../imports/api/collections/members.collection';
import PositionsCollection from '../../imports/api/collections/positions.collection';
import RanksCollection from '../../imports/api/collections/ranks.collection';
import { validateString } from '../main';

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

if (Meteor.isServer) {
  Meteor.methods({
    'squads.members': squadMembers,
  });
}
