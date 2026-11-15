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
  /** Server-owned. `null` = the scheduled event was deleted in Discord and must not be recreated. */
  discordEventId?: string | null;
  /** Server-owned: the announcement message in the events channel. */
  discordMessageId?: string;
}
