import { Mongo } from 'meteor/mongo';
import type { ProfilePicture } from '/imports/api/types';

const ProfilePicturesCollection = new Mongo.Collection<ProfilePicture>('profilePictures');

export default ProfilePicturesCollection;
