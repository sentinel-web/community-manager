import { Meteor } from "meteor/meteor";
import { Accounts } from "meteor/accounts-base";
import MembersCollection from "../../imports/api/collections/members.collection";

if (Meteor.isServer) {
  Meteor.publish("members", function (filter = {}, options = {}) {
    if (!this.userId) {
      return [];
    } else {
      return MembersCollection.find(filter, options);
    }
  });

  Meteor.methods({
    "members.register": async function (username = "", password = "password") {
      try {
        return await Accounts.createUserAsync({ username, password });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    "members.insert": async function (username, password) {
      if (!username || typeof username !== "string") {
        throw new Meteor.Error(
          "invalid-username",
          "Invalid username",
          username
        );
      }
      if (!password || typeof password !== "string") {
        throw new Meteor.Error(
          "invalid-password",
          "Invalid password",
          password
        );
      }
      if (!this.userId) {
        throw new Meteor.Error("not-authorized");
      } else {
        try {
          return await Accounts.createUserAsync({ username, password });
        } catch (error) {
          throw new Meteor.Error(error.message);
        }
      }
    },
    "members.update": async function (memberId = "", data = {}) {
      if (!memberId || typeof memberId !== "string") {
        throw new Meteor.Error(
          "invalid-member-id",
          "Invalid member ID",
          memberId
        );
      }
      if (!data || typeof data !== "object") {
        throw new Meteor.Error("invalid-data", "Invalid data", data);
      }
      if (!this.userId) {
        throw new Meteor.Error("not-authorized");
      } else {
        const member = await MembersCollection.findOneAsync(memberId);
        if (member) {
          try {
            return await MembersCollection.updateAsync(
              { _id: memberId },
              { $set: data }
            );
          } catch (error) {
            throw new Meteor.Error(error.message);
          }
        } else {
          throw new Meteor.Error("member-not-found");
        }
      }
    },
    "members.remove": async function (memberId = "") {
      if (!this.userId) {
        throw new Meteor.Error("not-authorized");
      } else {
        const member = await MembersCollection.findOneAsync(memberId);
        if (member) {
          try {
            return await MembersCollection.removeAsync({ _id: memberId });
          } catch (error) {
            throw new Meteor.Error(error.message);
          }
        } else {
          throw new Meteor.Error("member-not-found");
        }
      }
    },
  });
}
