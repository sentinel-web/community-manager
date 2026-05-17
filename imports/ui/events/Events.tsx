import { Col, Checkbox, DatePicker, Select } from 'antd';
import type { Dayjs } from 'dayjs';
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

type ViewType = 'calendar' | 'attendance' | 'table';

export default function Events() {
  const [viewType, setViewType] = useState<ViewType>('calendar');
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs().endOf('month')]);
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
    (string: string): Mongo.Selector<EventDoc> => {
      const eventTypesFilter = eventTypes?.length ? { eventType: { $in: eventTypes } } : {};
      const filter: Record<string, unknown> = {
        ...eventTypesFilter,
        name: { $regex: string, $options: 'i' },
        start: { $lte: dateRange?.[1]?.toDate?.() },
        end: { $gte: dateRange?.[0]?.toDate?.() },
      };
      if (relevantOnly && userId) {
        filter.$or = [{ hosts: userId }, { attendees: userId }];
      }
      return filter as Mongo.Selector<EventDoc>;
    },
    [dateRange, eventTypes, relevantOnly, userId]
  );

  const handleViewTypeChange = useCallback(
    (value: ViewType) => {
      if (value === 'attendance') setDateRange([dayjs().startOf('month').subtract(1, 'month'), dayjs().endOf('month')]);
      else setDateRange([dayjs().startOf('month'), dayjs().endOf('month')]);
      setViewType(value);
    },
    [setViewType, setDateRange]
  );

  const eventsRef = useTourRef('events-section');
  useTourAction('events-switch-calendar', () => handleViewTypeChange('calendar'));
  useTourAction('events-switch-attendance', () => handleViewTypeChange('attendance'));

  return (
    <div ref={eventsRef}>
      <Section<EventDoc>
        title={t('events.title')}
        collectionName="events"
        customView={customView}
        Collection={EventsCollection}
        FormComponent={EventForm}
        columnsFactory={getEventColumns}
        filterFactory={filterFactory}
        extra={<></>}
        useDrawerStack
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
                useDrawerStack
              />
            </Col>
            {(['table', 'attendance'] as ViewType[]).includes(viewType) && (
              <Col>
                <DatePicker.RangePicker value={dateRange} onChange={setDateRange as (value: unknown) => void} />
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
