import { Meteor } from 'meteor/meteor';
import MembersCollection from '../../imports/api/collections/members.collection';
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
  for (const member of members) {
    const rankName = ranks.find(r => r.value === member.profile.rankId)?.label || '-';
    const position = member.profile?.position;
    const label = position ? `${position} - ${rankName}` : rankName;
    items.push({
      label,
      children: `${member.profile.id} "${member.profile.name}"`,
    });
  }
  return items;
}

async function orbatSquads() {
  validateString(this.userId, false);
  const squads = await SquadsCollection.find({}).fetchAsync();
  return squads;
}

if (Meteor.isServer) {
  Meteor.methods({
    'orbat.popover.items': orbatPopoverItems,
    'orbat.squads': orbatSquads,
  });
}
