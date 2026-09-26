import type { EventId, MemberId } from './shared';

export interface EventDoc {
  _id?: EventId;
  name: string;
  start: Date;
  end: Date;
  eventType?: string;
  hosts?: MemberId[];
  attendees?: MemberId[];
  isPrivate?: boolean;
  color?: string;
  preset?: string;
  description?: string;
  rrule?: string;
  /** Set by the Discord bot once the event has been announced, so it is announced only once. */
  isAnnounced?: boolean;
}
