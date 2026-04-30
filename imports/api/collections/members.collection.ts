import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import type { Member } from '/imports/api/types/member';

// Meteor.users is Mongo.Collection<Meteor.User>; the augmented UserProfile matches Member.
const MembersCollection = Meteor.users as unknown as Mongo.Collection<Member>;

export default MembersCollection;
