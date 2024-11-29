import { Meteor } from "meteor/meteor";
import DiscoveryTypesCollection from "../../imports/api/collections/discoveryTypes.collection";

if (Meteor.isServer) {
    Meteor.publish("discoveryTypes", function (filter = {}, options = {}) {
        if (!this.userId) {
            return [];
        }
        return DiscoveryTypesCollection.find(filter, options);
    });

    Meteor.methods({
        "discoveryTypes.insert": async function ({ name = "", color = "", description = "" } = {}) {
            if (!name || typeof name !== "string") {
                throw new Meteor.Error("invalid-name", "Invalid name", name);
            }
            if (typeof color !== "string" && color != null) {
                throw new Meteor.Error("invalid-color", "Invalid color", color);
            }
            if (typeof description !== "string" && description != null) {
                throw new Meteor.Error("invalid-description", "Invalid description", description);
            }
            if (!this.userId) {
                throw new Meteor.Error("not-authorized");
            }
            try {
                return await DiscoveryTypesCollection.insertAsync({ name, color, description });
            } catch (error) {
                throw new Meteor.Error(error.message);
            }
        },
        "discoveryTypes.update": async function (discoveryTypeId = "", data = {}) {
            if (!discoveryTypeId || typeof discoveryTypeId !== "string") {
                throw new Meteor.Error("invalid-event-id", "Invalid event ID", discoveryTypeId);
            }
            if (!data || typeof data !== "object") {
                throw new Meteor.Error("invalid-data", "Invalid data", data);
            }
            if (!this.userId) {
                throw new Meteor.Error("not-authorized");
            }
            const discoveryType = await DiscoveryTypesCollection.findOneAsync(discoveryTypeId);
            if (discoveryType) {
                try {
                    return await DiscoveryTypesCollection.updateAsync(
                        { _id: discoveryTypeId },
                        { $set: data }
                    );
                } catch (error) {
                    throw new Meteor.Error(error.message);
                }
            } else {
                throw new Meteor.Error("discoveryType-not-found");
            }
        },
        "discoveryTypes.remove": async function (discoveryTypeId = "") {
            if (!discoveryTypeId || typeof discoveryTypeId !== "string") {
                throw new Meteor.Error("invalid-event-id", "Invalid event ID", discoveryTypeId);
            }
            if (!this.userId) {
                throw new Meteor.Error("not-authorized");
            }
            const event = await DiscoveryTypesCollection.findOneAsync(discoveryTypeId);
            if (event) {
                try {
                    return await DiscoveryTypesCollection.removeAsync({ _id: discoveryTypeId });
                } catch (error) {
                    throw new Meteor.Error(error.message);
                }
            } else {
                throw new Meteor.Error("event-not-found");
            }
        },
    });
}
