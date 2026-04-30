import { Meteor } from 'meteor/meteor';

export function handleEventEdit(e, event) {
  e.preventDefault();
  const name = prompt('Enter new event name', event.name);
  if (name && name !== event.name) {
    Meteor.callAsync('events.update', event._id, { name }).catch(error => {
      alert(JSON.stringify({ error: error.error, message: error.message }, null, 2));
    });
  }
}

export function handleEventDelete(e, event) {
  e.preventDefault();
  Meteor.callAsync('events.remove', event._id).catch(error => {
    alert(JSON.stringify({ error: error.error, message: error.message }, null, 2));
  });
}
