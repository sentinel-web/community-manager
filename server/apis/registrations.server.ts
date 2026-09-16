import { DDPRateLimiter } from 'meteor/ddp-rate-limiter';
import { Meteor } from 'meteor/meteor';
import MembersCollection from '../../imports/api/collections/members.collection';
import RegistrationsCollection from '../../imports/api/collections/registrations.collection';
import { RATE_LIMITS } from '../config';
import { validateNumber } from '../main';

if (Meteor.isServer) {
  Meteor.methods({
    'registrations.validateId': async function (id: number = 0, excludeId: string | false = false): Promise<boolean> {
      validateNumber(id, false);

      // Members are never the edit target on this path, so a member sharing the
      // id is always a real collision — no self-exclusion clause (the old
      // `{ 'profile.id': { $ne: id } }` push contradicted `{ 'profile.id': id }`
      // and silently masked member collisions on the edit path, #265).
      const matchingMembers = await MembersCollection.findOneAsync({ 'profile.id': id });

      const registrationFilter: Record<string, unknown> = {
        $and: [{ id: id }],
      };
      if (this.userId && excludeId) {
        (registrationFilter.$and as Record<string, unknown>[]).push({ _id: { $ne: excludeId } });
      }
      const matchingRegistrations = await RegistrationsCollection.findOneAsync(registrationFilter);
      return !(matchingMembers || matchingRegistrations);
    },
    'registrations.validateName': async function (name: string = '', excludeId: string | false = false): Promise<boolean> {
      if (!name || typeof name !== 'string') {
        throw new Meteor.Error('invalid-name', 'Invalid name', name);
      }

      // See validateId: members are never the edit target here, so a member
      // sharing the name is always a real collision. The old self-exclusion
      // push contradicted the match clause and masked member collisions (#265).
      const matchingMembers = await MembersCollection.findOneAsync({ 'profile.name': name });

      const registrationFilter: Record<string, unknown> = {
        $and: [{ name: name }],
      };
      if (this.userId && excludeId) {
        (registrationFilter.$and as Record<string, unknown>[]).push({ _id: { $ne: excludeId } });
      }
      const matchingRegistrations = await RegistrationsCollection.findOneAsync(registrationFilter);
      return !(matchingMembers || matchingRegistrations);
    },
  });

  // `registrations.insert` is the one mutation the app exposes without a login
  // (the public application form), so it gets a per-client-address budget.
  // Limits are configurable through Meteor.settings — see server/config.ts.
  DDPRateLimiter.addRule(
    {
      type: 'method',
      name: 'registrations.insert',
      clientAddress: () => true,
    },
    RATE_LIMITS.registrations.insert.count,
    RATE_LIMITS.registrations.insert.intervalMs,
  );
}
