import React, { useCallback, useContext, useEffect, useState } from 'react';
import useEvents from './events.hook';
import dayjs from 'dayjs';
import { Calendar, dayjsLocalizer } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { DrawerContext } from '../app/App';
import EventForm from './EventForm';
import { getLegibleTextColor } from '../../helpers/color.helper';
import { Meteor } from 'meteor/meteor';

const localizer = dayjsLocalizer(dayjs);
const DnDCalendar = withDragAndDrop(Calendar);

const EventCalendar = () => {
  const { events } = useEvents();
  const drawer = useContext(DrawerContext);

  const [eventTypes, setEventTypes] = useState([]);
  const fetchEventTypes = useCallback(() => {
    Meteor.callAsync('eventTypes.options')
      .then(res => setEventTypes(res))
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchEventTypes();
  }, [fetchEventTypes]);

  const getColorByEventType = useCallback(
    eventTypeId => {
      const option = eventTypes.find(option => option.value === eventTypeId);
      return option?.raw?.color;
    },
    [eventTypes]
  );

  const openForm = useCallback(
    event => {
      const isEdit = !!event?._id;
      const model = event || {};
      drawer.setDrawerTitle(isEdit ? 'Edit Event' : 'Create Event');
      drawer.setDrawerModel(model);
      drawer.setDrawerComponent(<EventForm setOpen={drawer.setDrawerOpen} />);
      drawer.setDrawerOpen(true);
    },
    [drawer]
  );

  const onEventDrop = useCallback(
    ({ event, start, end, allDay }) => {
      openForm({ ...event, start, end, allDay });
    },
    [openForm]
  );

  const onEventResize = useCallback(
    ({ event, start, end, allDay }) => {
      openForm({ ...event, start, end, allDay });
    },
    [openForm]
  );

  const onDragEnd = useCallback(
    ({ event }) => {
      openForm({ ...event });
    },
    [openForm]
  );

  const onSelectSlot = useCallback(
    slotInfo => {
      const { start, end } = slotInfo;
      openForm({ start, end });
    },
    [openForm]
  );

  const onSelectEvent = useCallback(
    (event, e) => {
      openForm(event);
    },
    [openForm]
  );

  return (
    <div style={{ height: window.innerHeight * 0.75 }}>
      <DnDCalendar
        localizer={localizer}
        events={events.map(e => ({ ...e, title: e.name }))}
        startAccessor="start"
        endAccessor="end"
        eventPropGetter={event => {
          const color = event.color || (event.eventType ? getColorByEventType(event.eventType) : undefined);
          const backgroundColor = color;
          const textColor = color ? getLegibleTextColor(backgroundColor) : undefined;
          return { style: { backgroundColor: backgroundColor, color: textColor } };
        }}
        draggableAccessor={event => true}
        onEventDrop={onEventDrop}
        onEventResize={onEventResize}
        onDragEnd={onDragEnd}
        onSelectSlot={onSelectSlot}
        onSelectEvent={onSelectEvent}
        formats={{
          timeGutterFormat: 'HH:mm',
        }}
        resizable
        selectable
      />
    </div>
  );
};

export default EventCalendar;
