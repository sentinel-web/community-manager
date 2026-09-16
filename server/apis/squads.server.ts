import { Meteor } from 'meteor/meteor';
import type { SquadMemberRow } from '/imports/api/types';
import { validateString } from '../main';
import loadSquadMemberRows from '../squad-member-rows';

async function squadMembers(this: Meteor.MethodThisType, squadId: string = ''): Promise<SquadMemberRow[]> {
  validateString(this.userId, false);
  validateString(squadId, false);
  return loadSquadMemberRows(squadId);
}

if (Meteor.isServer) {
  Meteor.methods({
    'squads.members': squadMembers,
  });
}
