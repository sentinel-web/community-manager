import { Meteor } from 'meteor/meteor';
import type { EventDoc } from '../../api/types/event';

export function handleEventEdit(e: Event, event: EventDoc) {
  e.preventDefault();
  const name = prompt('Enter new event name', event.name);
  if (name && name !== event.name) {
    Meteor.callAsync('events.update', event._id, { name }).catch((error: Meteor.Error) => {
      alert(JSON.stringify({ error: error.error, message: error.message }, null, 2));
    });
  }
}

export function handleEventDelete(e: Event, event: EventDoc) {
  e.preventDefault();
  Meteor.callAsync('events.remove', event._id).catch((error: Meteor.Error) => {
    alert(JSON.stringify({ error: error.error, message: error.message }, null, 2));
  });
}
