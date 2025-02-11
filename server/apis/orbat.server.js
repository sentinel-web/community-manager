import { Meteor } from 'meteor/meteor';
import { validateObject, validateString } from '../main';
import SquadsCollection from '../../imports/api/collections/squads.collection';
import MembersCollection from '../../imports/api/collections/members.collection';
import RanksCollection from '../../imports/api/collections/ranks.collection';

async function orbatPopoverItems(squadId = '') {
  validateString(squadId, false);
  const squad = await SquadsCollection.findOneAsync(squadId);
  validateObject(squad, false);
  const members = await MembersCollection.find({ 'profile.squadId': squadId }).fetchAsync();
  const items = [];
  const ranks = await RanksCollection.find({ _id: { $in: members.map(m => m.profile.rankId) } }).mapAsync(r => ({ value: r._id, label: r.name }));
  for (const member of members) {
    items.push({
      label: ranks.find(r => r.value === member.profile.rankId)?.label || '-',
      children: `${member.profile.id} "${member.profile.name}"`,
    });
  }
  return items;
}

if (Meteor.isServer) {
  Meteor.methods({
    'orbat.popover.items': orbatPopoverItems,
  });
}
