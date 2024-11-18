import { Meteor } from "meteor/meteor";
import SettingsCollection from "../../imports/api/collections/settings.collection";

if (Meteor.isServer) {
  Meteor.publish("settings", (filter = {}, options = {}) => SettingsCollection.find(filter, options));

  Meteor.methods({
    "settings.upsert": async function (key, value) {
      if (!this.userId) {
        throw new Meteor.Error("not-authorized");
      }
      if (!key || typeof key !== "string") {
        throw new Meteor.Error("invalid-key", "Invalid key", key);
      }
      if (!value) {
        throw new Meteor.Error("invalid-value", "Invalid value", value);
      }
      try {
        return await SettingsCollection.upsertAsync(key, {
          $set: { key, value },
        });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    "settings.remove": async function (key = null) {
      if (!this.userId) {
        throw new Meteor.Error("not-authorized");
      }
      try {
        return await SettingsCollection.removeAsync(key);
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
  });
}
