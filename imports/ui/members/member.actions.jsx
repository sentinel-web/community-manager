import { Meteor } from "meteor/meteor";

export function handleEdit(e, member) {
  e.preventDefault();
  const username = prompt("Enter new username", member.username);
  if (username && username !== member.username) {
    Meteor.callAsync("members.update", member._id, {
      username: username,
    }).catch((error) => {
      alert(
        JSON.stringify({ error: error.error, message: error.message }, null, 2)
      );
    });
  }
}

export function handleDelete(e, member) {
  e.preventDefault();
  Meteor.callAsync("members.remove", member._id).catch((error) => {
    alert(
      JSON.stringify({ error: error.error, message: error.message }, null, 2)
    );
  });
}
