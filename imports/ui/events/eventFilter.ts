import type { Dayjs } from 'dayjs';
import type { Mongo } from 'meteor/mongo';
import type { EventDoc } from '../../api/types/event';
import { BREAKPOINTS } from '../../config';

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

/** The views the calendar can *start* in — the only ones whose range we predict. */
export type CalendarStartView = 'month' | 'agenda';

/**
 * The view react-big-calendar mounts in: agenda on phones (the month grid is
 * unreadable there), month everywhere else. Shared with the owner of the date
 * filter so it can predict the calendar's range before the calendar mounts.
 */
export function getInitialCalendarView(): CalendarStartView {
  return typeof window !== 'undefined' && window.innerWidth < BREAKPOINTS.MOBILE ? 'agenda' : 'month';
}

/**
 * The range a freshly mounted react-big-calendar shows for `date`. The calendar
 * only reports ranges on navigation, so both it (on mount) and the owner of the
 * date filter (when switching to the calendar view) derive the initial range
 * from here. Later ranges come from the calendar's own `onRangeChange`, so the
 * navigable views (week/day) are deliberately not modelled.
 */
export function getCalendarRange(view: CalendarStartView, date: Dayjs): [Dayjs, Dayjs] {
  if (view === 'agenda') return [date.startOf('day'), date.add(AGENDA_LENGTH_DAYS, 'day').endOf('day')];
  // Month: the grid includes the leading/trailing days of the adjacent months.
  return [date.startOf('month').startOf('week'), date.endOf('month').endOf('week')];
}
