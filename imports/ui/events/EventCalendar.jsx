import dayjs from 'dayjs';
import 'dayjs/locale/de';
import 'dayjs/locale/fr';
import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import PropTypes from 'prop-types';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Calendar, dayjsLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import EventTypesCollection from '../../api/collections/eventTypes.collection';
import getLegibleTextColor from '../../helpers/colors/getLegibleTextColor';
import { useLanguage } from '../../i18n/LanguageContext';
import { DrawerContext } from '../app/App';
import EventForm from './EventForm';

const DnDCalendar = withDragAndDrop(Calendar);

const EventCalendar = ({ datasource, setFilter }) => {
  const { t, language } = useLanguage();
  const drawer = useContext(DrawerContext);

  // Set dayjs locale based on current language
  useEffect(() => {
    dayjs.locale(language);
  }, [language]);

  // Create localizer with current locale
  const localizer = useMemo(() => dayjsLocalizer(dayjs), [language]);
  const [range, setRange] = useState({
    start: dayjs().startOf('month').startOf('week').toDate(),
    end: dayjs().endOf('month').endOf('week').toDate(),
  });
  const eventTypeIds = useMemo(() => datasource?.map?.(doc => doc.eventType) || [], [datasource]);
  useSubscribe('eventTypes', { _id: { $in: eventTypeIds } });
  const eventTypes = useFind(() => EventTypesCollection.find({ _id: { $in: eventTypeIds } }), [datasource]);

  const openForm = event => {
    const isEdit = !!event?._id;
    const model = event || {};
    drawer.setDrawerTitle(isEdit ? t('events.editEvent') : t('events.createEvent'));
    drawer.setDrawerModel(model);
    drawer.setDrawerComponent(<EventForm setOpen={drawer.setDrawerOpen} />);
    drawer.setDrawerOpen(true);
  };

  const onEventDrop = ({ event, start, end, allDay }) => {
    openForm({ ...event, start, end, allDay });
  };

  const onEventResize = ({ event, start, end, allDay }) => {
    openForm({ ...event, start, end, allDay });
  };

  const onDragEnd = ({ event }) => {
    openForm({ ...event });
  };

  const onSelectSlot = slotInfo => {
    const { start, end } = slotInfo;
    openForm({ start, end });
  };

  const onSelectEvent = (event, e) => {
    openForm(event);
    e.stopPropagation();
  };

  const eventPropGetter = event => {
    const color = event.color || (event.eventType ? eventTypes.find(doc => doc._id === event.eventType)?.color || undefined : undefined);
    const backgroundColor = color;
    const textColor = color ? getLegibleTextColor(backgroundColor) : undefined;
    return { style: { backgroundColor: backgroundColor, color: textColor } };
  };

  const draggableAccessor = () => {
    return true;
  };

  const formats = useMemo(() => ({ timeGutterFormat: 'HH:mm' }), []);

  const messages = useMemo(
    () => ({
      today: t('common.today'),
      previous: t('common.back'),
      next: t('common.next'),
      month: t('common.month'),
      week: t('common.week'),
      day: t('common.day'),
      agenda: t('common.agenda'),
    }),
    [t]
  );

  const [currentView, setCurrentView] = useState('month');

  const handleRangeChange = useCallback(
    (value, view) => {
      const newRange = { ...range };
      switch (view ?? currentView) {
        case 'day':
        case 'week':
          newRange.start = dayjs(value[0]).startOf('day').toDate();
          newRange.end = dayjs(value[value.length - 1])
            .endOf('day')
            .toDate();
          break;
        case 'month':
        case 'agenda':
          newRange.start = dayjs(value.start).startOf('day').toDate();
          newRange.end = dayjs(value.end).endOf('day').toDate();
          break;
        default:
          break;
      }
      setCurrentView(view ?? currentView);
      setRange(newRange);
      setFilter?.(prev => ({ ...(prev ?? {}), start: { $lte: newRange.end }, end: { $gte: newRange.start } }));
    },
    [range, currentView]
  );

  const events = useMemo(() => datasource?.map?.(event => ({ ...event, title: event.name })) || [], [datasource]);

  return (
    <div style={{ height: window.innerHeight * 0.75 }}>
      <DnDCalendar
        startAccessor="start"
        endAccessor="end"
        localizer={localizer}
        events={events}
        formats={formats}
        messages={messages}
        draggableAccessor={draggableAccessor}
        onEventDrop={onEventDrop}
        onEventResize={onEventResize}
        onDragEnd={onDragEnd}
        onSelectSlot={onSelectSlot}
        onSelectEvent={onSelectEvent}
        eventPropGetter={eventPropGetter}
        onRangeChange={handleRangeChange}
        resizable
        selectable
      />
    </div>
  );
};
EventCalendar.propTypes = {
  datasource: PropTypes.array,
  setFilter: PropTypes.func,
};

export default EventCalendar;
