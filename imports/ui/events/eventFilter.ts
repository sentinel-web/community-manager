import type { Dayjs } from 'dayjs';
import type { Mongo } from 'meteor/mongo';
import type { View } from 'react-big-calendar';
import type { EventDoc } from '../../api/types/event';

/** Selected date range; either bound (or the whole range, when cleared) may be absent. */
export type EventDateRange = [Dayjs | null, Dayjs | null] | null;

export interface EventFilterCriteria {
  search: string;
  dateRange: EventDateRange;
  eventTypes: readonly string[];
  relevantOnly: boolean;
  userId: string | null;
}

/**
 * Builds the Events section selector. Every events view (calendar, attendance,
 * table) filters through this one function, so the date range owned by
 * `Events` is the single source of truth.
 *
 * The range is day-inclusive (`startOf('day')` … `endOf('day')`) and matches
 * events that overlap it, not only those fully inside it.
 */
export function buildEventFilter({ search, dateRange, eventTypes, relevantOnly, userId }: EventFilterCriteria): Mongo.Selector<EventDoc> {
  const filter: Record<string, unknown> = { name: { $regex: search, $options: 'i' } };
  if (eventTypes.length) filter.eventType = { $in: [...eventTypes] };

  const [from, to] = dateRange ?? [null, null];
  if (to) filter.start = { $lte: to.endOf('day').toDate() };
  if (from) filter.end = { $gte: from.startOf('day').toDate() };

  if (relevantOnly && userId) filter.$or = [{ hosts: userId }, { attendees: userId }];
  return filter as Mongo.Selector<EventDoc>;
}

// react-big-calendar's agenda view spans this many days from its date.
const AGENDA_LENGTH_DAYS = 30;

/**
 * The range a react-big-calendar view shows for `date`. The calendar only
 * reports ranges on navigation, so it uses this to report its initial range
 * on mount.
 */
export function getCalendarRange(view: View, date: Dayjs): [Dayjs, Dayjs] {
  switch (view) {
    case 'agenda':
      return [date.startOf('day'), date.add(AGENDA_LENGTH_DAYS, 'day').endOf('day')];
    case 'day':
      return [date.startOf('day'), date.endOf('day')];
    case 'week':
      return [date.startOf('week'), date.endOf('week')];
    case 'month':
    default:
      return [date.startOf('month').startOf('week'), date.endOf('month').endOf('week')];
  }
}
