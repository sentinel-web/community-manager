import assert from 'node:assert';
import dayjs from 'dayjs';
import { buildEventFilter, getCalendarRange, type EventFilterCriteria } from '../../imports/ui/events/eventFilter';

const baseCriteria: EventFilterCriteria = {
  search: '',
  dateRange: null,
  eventTypes: [],
  relevantOnly: false,
  userId: null,
};

function build(overrides: Partial<EventFilterCriteria>): Record<string, unknown> {
  return buildEventFilter({ ...baseCriteria, ...overrides }) as Record<string, unknown>;
}

describe('buildEventFilter (#358)', () => {
  it('matches the name case-insensitively', () => {
    assert.deepStrictEqual(build({ search: 'op' }).name, { $regex: 'op', $options: 'i' });
  });

  it('widens the date range to whole days and matches overlapping events', () => {
    const from = dayjs('2026-03-02T15:30:00');
    const to = dayjs('2026-03-08T09:15:00');

    const filter = build({ dateRange: [from, to] });

    assert.deepStrictEqual(filter.start, { $lte: to.endOf('day').toDate() });
    assert.deepStrictEqual(filter.end, { $gte: from.startOf('day').toDate() });
  });

  it('applies no date bounds when the range is cleared', () => {
    const filter = build({ dateRange: null });

    assert.strictEqual('start' in filter, false);
    assert.strictEqual('end' in filter, false);
  });

  it('filters by event type only when types are selected', () => {
    assert.strictEqual('eventType' in build({ eventTypes: [] }), false);
    assert.deepStrictEqual(build({ eventTypes: ['training', 'operation'] }).eventType, { $in: ['training', 'operation'] });
  });

  it('restricts to events the user hosts or attends when relevant-only is on', () => {
    assert.deepStrictEqual(build({ relevantOnly: true, userId: 'user-1' }).$or, [{ hosts: 'user-1' }, { attendees: 'user-1' }]);
  });

  it('ignores relevant-only without a user', () => {
    assert.strictEqual('$or' in build({ relevantOnly: true, userId: null }), false);
  });

  it('produces a different selector when any criterion changes', () => {
    const march = build({ dateRange: [dayjs('2026-03-01'), dayjs('2026-03-31')] });
    const april = build({ dateRange: [dayjs('2026-04-01'), dayjs('2026-04-30')] });

    assert.notDeepStrictEqual(march, april);
  });
});

describe('getCalendarRange (#358)', () => {
  const date = dayjs('2026-03-18T12:00:00');

  it('covers the whole visible month grid, including leading and trailing weeks', () => {
    const [start, end] = getCalendarRange('month', date);

    assert.ok(start.isSame(date.startOf('month').startOf('week')));
    assert.ok(end.isSame(date.endOf('month').endOf('week')));
  });

  it('covers the agenda length from the start of the day', () => {
    const [start, end] = getCalendarRange('agenda', date);

    assert.ok(start.isSame(date.startOf('day')));
    assert.ok(end.isSame(date.add(30, 'day').endOf('day')));
  });

  it('covers a single day for the day view', () => {
    const [start, end] = getCalendarRange('day', date);

    assert.ok(start.isSame(date.startOf('day')));
    assert.ok(end.isSame(date.endOf('day')));
  });
});
