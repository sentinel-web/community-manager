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
}
