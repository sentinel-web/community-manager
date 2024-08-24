import { Meteor } from "meteor/meteor";
import SettingsCollection from "../../imports/api/collections/settings.collection";

if (Meteor.isServer) {
  Meteor.publish("settings", function (filter = {}, options = {}) {
    return SettingsCollection.find(filter, options);
  });

  Meteor.methods({
    "settings.upsert": async function (key = null, value) {
      if (!this.userId) {
        throw new Meteor.Error("not-authorized");
      } else {
        try {
          return await SettingsCollection.upsertAsync(key, {
            $set: { key, value },
          });
        } catch (error) {
          throw new Meteor.Error(error.message);
        }
      }
    },
    "settings.remove": async function (key = null) {
      if (!this.userId) {
        throw new Meteor.Error("not-authorized");
      } else {
        try {
          return await SettingsCollection.removeAsync(key);
        } catch (error) {
          throw new Meteor.Error(error.message);
        }
      }
    },
  });
}
