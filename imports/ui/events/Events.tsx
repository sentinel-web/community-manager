import { Col, Checkbox, DatePicker, Select } from 'antd';
import dayjs from 'dayjs';
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { useTracker } from 'meteor/react-meteor-data';
import React, { useCallback, useMemo, useState } from 'react';
import EventTypesCollection from '../../api/collections/eventTypes.collection';
import EventsCollection from '../../api/collections/events.collection';
import type { CollectionDoc } from '../components/CollectionSelect';
import { useTranslation } from '../../i18n/LanguageContext';
import type { TranslateFn } from '../section/types';
import CollectionSelect from '../components/CollectionSelect';
import Section from '../section/Section';
import { useTourRef, useTourAction } from '../tour/TourContext';
import type { EventDoc } from '../../api/types/event';
import EventAttendance from './EventAttendance';
import EventCalendar from './EventCalendar';
import EventForm from './EventForm';
import EventTypesForm from './event-types/EventTypesForm';
import getEventColumns from './event.columns';
import { buildEventFilter, getCalendarRange, getInitialCalendarView, type EventDateRange } from './eventFilter';
import { PUBLISH_LIMITS } from '../../config';

type ViewType = 'calendar' | 'attendance' | 'table';

const EVENT_SORT = { start: 1 } as const;

interface EventsViewProps {
  onRangeChange: (start: Date, end: Date) => void;
}

export default function Events() {
  const [viewType, setViewType] = useState<ViewType>('calendar');
  // Single source of truth for the date filter: the range picker writes it in
  // the table/attendance views, the calendar reports its visible range into it.
  const [dateRange, setDateRange] = useState<EventDateRange>(() => getCalendarRange(getInitialCalendarView(), dayjs()));
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [relevantOnly, setRelevantOnly] = useState(false);
  const { t } = useTranslation();
  const userId = useTracker(() => Meteor.userId(), []);

  const customView = useMemo(() => {
    switch (viewType) {
      case 'calendar':
        return EventCalendar;
      case 'attendance':
        return EventAttendance;
      default:
        return false as const;
    }
  }, [viewType]);

  const filterFactory = useCallback(
    (search: string): Mongo.Selector<EventDoc> => buildEventFilter({ search, dateRange, eventTypes, relevantOnly, userId }),
    [dateRange, eventTypes, relevantOnly, userId]
  );

  const handleCalendarRangeChange = useCallback((start: Date, end: Date) => {
    setDateRange([dayjs(start), dayjs(end)]);
  }, []);
  const customViewProps = useMemo<EventsViewProps>(() => ({ onRangeChange: handleCalendarRangeChange }), [handleCalendarRangeChange]);

  const handleViewTypeChange = useCallback((value: ViewType) => {
    // Every view gets its range set synchronously, including the calendar:
    // otherwise the switch renders one frame against the outgoing view's range
    // — unbounded if the range picker had been cleared — before the calendar
    // mounts and reports its own. That mount report still lands and corrects
    // this if the calendar opens on a different range than predicted.
    if (value === 'attendance') setDateRange([dayjs().startOf('month').subtract(1, 'month'), dayjs().endOf('month')]);
    else if (value === 'table') setDateRange([dayjs().startOf('month'), dayjs().endOf('month')]);
    else setDateRange(getCalendarRange(getInitialCalendarView(), dayjs()));
    setViewType(value);
  }, []);

  const eventsRef = useTourRef('events-section');
  useTourAction('events-switch-calendar', () => handleViewTypeChange('calendar'));
  useTourAction('events-switch-attendance', () => handleViewTypeChange('attendance'));

  return (
    <div ref={eventsRef}>
      <Section<EventDoc, EventsViewProps>
        title={t('events.title')}
        collectionName="events"
        customView={customView}
        Collection={EventsCollection}
        FormComponent={EventForm}
        columnsFactory={getEventColumns}
        filterFactory={filterFactory}
        sort={EVENT_SORT}
        customViewProps={customViewProps}
        // Calendar and attendance grid are bounded by the date range above, so
        // they must show every event in it — not just the first table page (#359).
        customViewLimit={PUBLISH_LIMITS.MAX}
        extra={<></>}
        headerExtra={
          <>
            <Col>
              <CollectionSelect
                FormComponent={EventTypesForm}
                collection={EventTypesCollection as unknown as Mongo.Collection<CollectionDoc>}
                defaultValue={eventTypes}
                onChange={setEventTypes as (value: string | string[]) => void}
                placeholder={t('events.filterByType')}
                mode="multiple"
                subscription="eventTypes"
              />
            </Col>
            {(['table', 'attendance'] as ViewType[]).includes(viewType) && (
              <Col>
                <DatePicker.RangePicker value={dateRange} onChange={setDateRange} />
              </Col>
            )}
            <Col>
              <Checkbox checked={relevantOnly} onChange={e => setRelevantOnly(e.target.checked)}>
                {t('events.relevantToMe')}
              </Checkbox>
            </Col>
            <Col>
              <ViewTypeSelector viewType={viewType} handleChange={handleViewTypeChange} t={t} />
            </Col>
          </>
        }
      />
    </div>
  );
}

interface ViewTypeSelectorProps {
  viewType: ViewType;
  handleChange: (value: ViewType) => void;
  t: TranslateFn;
}

const ViewTypeSelector = ({ viewType, handleChange, t }: ViewTypeSelectorProps) => {
  const viewTypes = useMemo(
    () => [
      { value: 'calendar' as ViewType, label: t('events.calendar') },
      { value: 'attendance' as ViewType, label: t('events.attendance') },
      { value: 'table' as ViewType, label: t('events.table') },
    ],
    [t]
  );
  return <Select style={{ minWidth: 125 }} value={viewType} onChange={handleChange} options={viewTypes} optionFilterProp="label" showSearch />;
};
