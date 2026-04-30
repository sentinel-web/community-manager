import { Col, Checkbox, DatePicker, Select } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { useTracker } from 'meteor/react-meteor-data';
import React, { useCallback, ComponentType, useMemo, useState } from 'react';
import EventTypesCollection from '../../api/collections/eventTypes.collection';
import EventsCollection from '../../api/collections/events.collection';
import type { CollectionDoc } from '../components/CollectionSelect';
import { useTranslation } from '../../i18n/LanguageContext';
import type { TranslateFn, ColumnsFactory } from '../section/types';
import type { TourElementRef } from '../tour/TourContext';
import CollectionSelect from '../components/CollectionSelect';
import Section from '../section/Section';
import { useTourRef, useTourAction } from '../tour/TourContext';
import EventAttendance from './EventAttendance';
import EventCalendar from './EventCalendar';
import EventForm from './EventForm';
import EventTypesForm from './event-types/EventTypesForm';
import getEventColumns from './event.columns';

type ViewType = 'calendar' | 'attendance' | 'table';

// Section uses CollectionDoc generics; cast once here
type SectionCustomView = ComponentType<{
  handleEdit: (e: React.MouseEvent<HTMLElement>, record: CollectionDoc) => void;
  handleDelete: (e: React.MouseEvent<HTMLElement>, record: CollectionDoc) => void;
  datasource: CollectionDoc[];
  setFilter: (filter: Mongo.Selector<CollectionDoc>) => void;
  permissions: { canCreate: boolean; canUpdate: boolean; canDelete: boolean };
}>;

export default function Events() {
  const [viewType, setViewType] = useState<ViewType>('calendar');
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs().endOf('month')]);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [relevantOnly, setRelevantOnly] = useState(false);
  const { t } = useTranslation();
  const userId = useTracker(() => Meteor.userId(), []);

  const customView = useMemo<SectionCustomView | false>(() => {
    switch (viewType) {
      case 'calendar':
        return EventCalendar as unknown as SectionCustomView;
      case 'attendance':
        return EventAttendance as unknown as SectionCustomView;
      default:
        return false;
    }
  }, [viewType]);

  const filterFactory = useCallback(
    (string: string): Mongo.Selector<CollectionDoc> => {
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
      return filter as Mongo.Selector<CollectionDoc>;
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
    <div ref={eventsRef as React.RefObject<HTMLDivElement>}>
      <Section
        title={t('events.title')}
        collectionName="events"
        customView={customView}
        Collection={EventsCollection as unknown as Mongo.Collection<CollectionDoc>}
        FormComponent={EventForm}
        columnsFactory={getEventColumns as unknown as ColumnsFactory<CollectionDoc>}
        filterFactory={filterFactory}
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
