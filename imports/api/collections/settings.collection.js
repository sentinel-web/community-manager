import { Mongo } from "meteor/mongo";

const SettingsCollection = new Mongo.Collection("settings");

export default SettingsCollection;
