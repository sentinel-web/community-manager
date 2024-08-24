import { Meteor } from "meteor/meteor";

export function handleTaskEdit(e, task) {
  e.preventDefault();
  const name = prompt("Enter new task name", task.name);
  if (name) {
    const status = prompt("Enter status", task.status);
    if (status) {
      if (name !== task.name || status !== task.status) {
        Meteor.callAsync("tasks.update", task._id, { name, status }).catch(
          (error) => {
            alert(
              JSON.stringify(
                { error: error.error, message: error.message },
                null,
                2
              )
            );
          }
        );
      }
    }
  }
}

export function handleTaskDelete(e, task) {
  e.preventDefault();
  Meteor.callAsync("tasks.remove", task._id).catch((error) => {
    alert(
      JSON.stringify({ error: error.error, message: error.message }, null, 2)
    );
  });
}
