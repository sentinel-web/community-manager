import { Meteor } from "meteor/meteor";
import RegistrationsCollection from "../../imports/api/collections/registrations.collection";
import MembersCollection from "../../imports/api/collections/members.collection";

if (Meteor.isServer) {
  Meteor.publish("registrations", function (filter = {}, options = {}) {
    if (!this.userId) {
      return [];
    }
    return RegistrationsCollection.find(filter, options);
  });

  Meteor.methods({
    "registrations.insert": async (payload = {}) => {
      if (!payload || typeof payload !== "object") {
        throw new Meteor.Error("invalid-payload", "Invalid payload", payload);
      }
      try {
        return await RegistrationsCollection.insertAsync(payload);
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    "registrations.update": async function (registrationId = "", data = {}) {
      if (!registrationId || typeof registrationId !== "string") {
        throw new Meteor.Error(
          "invalid-registration-id",
          "Invalid registration ID",
          registrationId
        );
      }
      if (!data || typeof data !== "object") {
        throw new Meteor.Error("invalid-data", "Invalid data", data);
      }
      if (!this.userId) {
        throw new Meteor.Error("not-authorized");
      }
      const registration = await RegistrationsCollection.findOneAsync(
        registrationId
      );
      if (registration) {
        try {
          return await RegistrationsCollection.updateAsync(
            { _id: registrationId },
            { $set: data }
          );
        } catch (error) {
          throw new Meteor.Error(error.message);
        }
      } else {
        throw new Meteor.Error("registration-not-found");
      }
    },
    "registrations.remove": async function (registrationId = "") {
      if (!registrationId || typeof registrationId !== "string") {
        throw new Meteor.Error(
          "invalid-registration-id",
          "Invalid registration ID",
          registrationId
        );
      }
      if (!this.userId) {
        throw new Meteor.Error("not-authorized");
      }
      const registration = await RegistrationsCollection.findOneAsync(
        registrationId
      );
      if (registration) {
        try {
          return await RegistrationsCollection.removeAsync({
            _id: registrationId,
          });
        } catch (error) {
          throw new Meteor.Error(error.message);
        }
      } else {
        throw new Meteor.Error("registration-not-found");
      }
    },
    "registrations.validateId": async function (id = "", excludeId = false) {
      if (!id || typeof id !== "number") {
        throw new Meteor.Error("invalid-id", "Invalid ID", id);
      }

      const filter = { $and: [{ "profile.id": id }] };
      if (this.userId && excludeId) {
        filter.$and.push({ "profile.id": { $ne: id } });
      }
      const matchingMembers = await MembersCollection.findOneAsync(filter);

      const registrationFilter = {
        $and: [{ id: id }],
      };
      if (this.userId && excludeId) {
        registrationFilter.$and.push({ _id: { $ne: excludeId } });
      }
      const matchingRegistrations = await RegistrationsCollection.findOneAsync(
        registrationFilter
      );
      return !(matchingMembers || matchingRegistrations);
    },
    "registrations.validateName": async function (
      name = "",
      excludeid = false
    ) {
      if (!name || typeof name !== "string") {
        throw new Meteor.Error("invalid-name", "Invalid name", name);
      }

      const filter = {
        $and: [{ "profile.name": name }],
      };
      if (this.userId && excludeid) {
        filter.$and.push({ "profile.name": { $ne: name } });
      }
      const matchingMembers = await MembersCollection.findOneAsync(filter);

      const registrationFilter = {
        $and: [{ name: name }],
      };
      if (this.userId && excludeid) {
        registrationFilter.$and.push({ _id: { $ne: excludeid } });
      }
      const matchingRegistrations = await RegistrationsCollection.findOneAsync(
        registrationFilter
      );
      return !(matchingMembers || matchingRegistrations);
    },
  });
}
