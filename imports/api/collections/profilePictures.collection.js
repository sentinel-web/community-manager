import { Mongo } from 'meteor/mongo';

const ProfilePicturesCollection = new Mongo.Collection('profilePictures');

export default ProfilePicturesCollection;
