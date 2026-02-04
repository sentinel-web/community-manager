import { Col, DatePicker, Select } from 'antd';
import dayjs from 'dayjs';
import PropTypes from 'prop-types';
import React, { useCallback, useMemo, useState } from 'react';
import EventTypesCollection from '../../api/collections/eventTypes.collection';
import EventsCollection from '../../api/collections/events.collection';
import { useTranslation } from '../../i18n/LanguageContext';
import CollectionSelect from '../components/CollectionSelect';
import Section from '../section/Section';
import EventAttendance from './EventAttendance';
import EventCalendar from './EventCalendar';
import EventForm from './EventForm';
import EventTypesForm from './event-types/EventTypesForm';
import getEventColumns from './event.columns';

export default function Events() {
  const [viewType, setViewType] = useState('calendar');
  const [dateRange, setDateRange] = useState([dayjs().startOf('month'), dayjs().endOf('month')]);
  const [eventTypes, setEventTypes] = useState([]);
  const { t } = useTranslation();
  const customView = useMemo(() => {
    switch (viewType) {
      case 'calendar':
        return EventCalendar;
      case 'attendance':
        return EventAttendance;
      default:
        return false;
    }
  }, [viewType]);

  const filterFactory = useCallback(
    string => {
      const eventTypesFilter = eventTypes?.length ? { eventType: { $in: eventTypes } } : {};
      const filter = {
        ...eventTypesFilter,
        name: { $regex: string, $options: 'i' },
        start: { $lte: dateRange?.[1]?.toDate?.() },
        end: { $gte: dateRange?.[0]?.toDate?.() },
      };
      return filter;
    },
    [dateRange, eventTypes]
  );

  const handleViewTypeChange = useCallback(
    value => {
      if (value === 'attendance') setDateRange([dayjs().startOf('month').subtract(1, 'month'), dayjs().endOf('month')]);
      else setDateRange([dayjs().startOf('month'), dayjs().endOf('month')]);
      setViewType(value);
    },
    [setViewType, setDateRange]
  );

  return (
    <Section
      title={t('events.title')}
      collectionName="events"
      customView={customView}
      Collection={EventsCollection}
      FormComponent={EventForm}
      columnsFactory={getEventColumns}
      filterFactory={filterFactory}
      extra={<></>}
      headerExtra={
        <>
          <Col>
            <CollectionSelect
              FormComponent={EventTypesForm}
              collection={EventTypesCollection}
              defaultValue={eventTypes}
              onChange={setEventTypes}
              placeholder={t('events.filterByType')}
              mode="multiple"
              subscription="eventTypes"
            />
          </Col>
          {['table', 'attendance'].includes(viewType) && (
            <Col>
              <DatePicker.RangePicker value={dateRange} onChange={setDateRange} />
            </Col>
          )}
          <Col>
            <ViewTypeSelector viewType={viewType} handleChange={handleViewTypeChange} t={t} />
          </Col>
        </>
      }
    />
  );
}

const ViewTypeSelector = ({ viewType, handleChange, t }) => {
  const viewTypes = useMemo(() => [
    { value: 'calendar', label: t('events.calendar') },
    { value: 'attendance', label: t('events.attendance') },
    { value: 'table', label: t('events.table') },
  ], [t]);
  return <Select style={{ minWidth: 125 }} value={viewType} onChange={handleChange} options={viewTypes} optionFilterProp="label" showSearch />;
};
ViewTypeSelector.propTypes = {
  viewType: PropTypes.string,
  handleChange: PropTypes.func,
  t: PropTypes.func,
};
