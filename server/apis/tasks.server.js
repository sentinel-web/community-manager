import { Meteor } from "meteor/meteor";
import TasksCollection from "../../imports/api/collections/tasks.collection";

if (Meteor.isServer) {
  Meteor.publish("tasks", function (filter = {}, options = {}) {
    if (!this.userId) {
      return [];
    }
    return TasksCollection.find(filter, options);
  });

  Meteor.methods({
    "tasks.insert": async function (payload = {}) {
      const { name, status, description, participants } = payload;
      if (!name || typeof name !== "string") {
        throw new Meteor.Error("invalid-name", "Invalid name", name);
      }
      if (!status || typeof status !== "string") {
        throw new Meteor.Error("invalid-status", "Invalid status", status);
      }
      if (typeof description !== "string" && description != null) {
        throw new Meteor.Error("invalid-description", "Invalid description", description);
      }
      if (!this.userId) {
        throw new Meteor.Error("not-authorized");
      }
      try {
        return await TasksCollection.insertAsync({ name, status, description, participants });
      } catch (error) {
        throw new Meteor.Error(error.message);
      }
    },
    "tasks.update": async function (taskId = "", data = {}) {
      if (!taskId || typeof taskId !== "string") {
        throw new Meteor.Error("invalid-task-id", "Invalid task ID", taskId);
      }
      if (!data || typeof data !== "object") {
        throw new Meteor.Error("invalid-data", "Invalid data", data);
      }
      if (!this.userId) {
        throw new Meteor.Error("not-authorized");
      }
      const task = await TasksCollection.findOneAsync(taskId);
      if (task) {
        try {
          return await TasksCollection.updateAsync(
            { _id: taskId },
            { $set: data }
          );
        } catch (error) {
          throw new Meteor.Error(error.message);
        }
      } else {
        throw new Meteor.Error("task-not-found");
      }
    },
    "tasks.remove": async function (taskId = "") {
      if (!taskId || typeof taskId !== "string") {
        throw new Meteor.Error("invalid-task-id", "Invalid task ID", taskId);
      }
      if (!this.userId) {
        throw new Meteor.Error("not-authorized");
      }
      const task = await TasksCollection.findOneAsync(taskId);
      if (task) {
        try {
          return await TasksCollection.removeAsync({ _id: taskId });
        } catch (error) {
          throw new Meteor.Error(error.message);
        }
      } else {
        throw new Meteor.Error("task-not-found");
      }
    },
  });
}
