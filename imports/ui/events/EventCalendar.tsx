import dayjs from 'dayjs';
import 'dayjs/locale/de';
import 'dayjs/locale/fr';
import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, dayjsLocalizer } from 'react-big-calendar';
import type { CalendarEvent, DateRange, View } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import EventTypesCollection from '../../api/collections/eventTypes.collection';
import getLegibleTextColor from '../../helpers/colors/getLegibleTextColor';
import { useLanguage } from '../../i18n/LanguageContext';
import type { EventDoc } from '../../api/types/event';
import { useDrawerStack } from '../drawer-stack';
import EventDetailPopover from './EventDetailPopover';
import EventForm from './EventForm';
import { useTourRef } from '../tour/TourContext';

const DnDCalendar = withDragAndDrop(Calendar);

interface EventCalendarProps {
  datasource?: EventDoc[];
  setFilter?: (updater: (prev: Record<string, unknown> | null) => Record<string, unknown>) => void;
}

const EventCalendar = ({ datasource, setFilter }: EventCalendarProps) => {
  const calendarRef = useTourRef('events-calendar');
  const { t, language } = useLanguage();
  const drawerStack = useDrawerStack();

  // Set dayjs locale based on current language
  useEffect(() => {
    dayjs.locale(language);
  }, [language]);

  // Create localizer with current locale
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const localizer = useMemo(() => dayjsLocalizer(dayjs), [language]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEvent, setDetailEvent] = useState<EventDoc | null>(null);

  const [range, setRange] = useState({
    start: dayjs().startOf('month').startOf('week').toDate(),
    end: dayjs().endOf('month').endOf('week').toDate(),
  });
  const eventTypeIds = useMemo(() => datasource?.map?.(doc => doc.eventType) || [], [datasource]);
  useSubscribe('eventTypes', { _id: { $in: eventTypeIds } });
  const eventTypes = useFind(() => EventTypesCollection.find({ _id: { $in: eventTypeIds } }), [datasource]);

  const openForm = useCallback(
    (event?: Record<string, unknown>) => {
      const isEdit = !!event?._id;
      const model = event || {};
      void drawerStack.push<string, Record<string, unknown>>({
        title: isEdit ? t('events.editEvent') : t('events.createEvent'),
        Component: EventForm,
        model,
      });
    },
    [drawerStack, t]
  );

  const onEventDrop = ({ event, start, end, allDay }: { event: CalendarEvent; start: Date; end: Date; allDay?: boolean }) => {
    openForm({ ...(event as Record<string, unknown>), start, end, allDay });
  };

  const onEventResize = ({ event, start, end, allDay }: { event: CalendarEvent; start: Date; end: Date; allDay?: boolean }) => {
    openForm({ ...(event as Record<string, unknown>), start, end, allDay });
  };

  const onDragEnd = ({ event }: { event: CalendarEvent }) => {
    openForm({ ...(event as Record<string, unknown>) });
  };

  const onSelectSlot = (slotInfo: { start: Date; end: Date }) => {
    const { start, end } = slotInfo;
    openForm({ start, end });
  };

  const onSelectEvent = (event: CalendarEvent, e: React.SyntheticEvent) => {
    setDetailEvent(event as unknown as EventDoc);
    setDetailOpen(true);
    e.stopPropagation();
  };

  const eventPropGetter = (event: CalendarEvent) => {
    const color =
      event.color ||
      (event.eventType ? eventTypes.find(doc => doc._id === (event.eventType as string))?.color ?? undefined : undefined);
    const backgroundColor = color as string | undefined;
    const textColor = backgroundColor ? getLegibleTextColor(backgroundColor) : undefined;
    return { style: { backgroundColor, color: textColor } };
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

  const [currentView, setCurrentView] = useState<View>('month');

  const handleRangeChange = useCallback(
    (value: Date[] | DateRange, view?: View) => {
      const newRange = { ...range };
      switch (view ?? currentView) {
        case 'day':
        case 'week': {
          const dateArray = value as Date[];
          newRange.start = dayjs(dateArray[0]).startOf('day').toDate();
          newRange.end = dayjs(dateArray[dateArray.length - 1])
            .endOf('day')
            .toDate();
          break;
        }
        case 'month':
        case 'agenda': {
          const dateRange = value as DateRange;
          newRange.start = dayjs(dateRange.start).startOf('day').toDate();
          newRange.end = dayjs(dateRange.end).endOf('day').toDate();
          break;
        }
        default:
          break;
      }
      setCurrentView(view ?? currentView);
      setRange(newRange);
      setFilter?.(prev => ({ ...(prev ?? {}), start: { $lte: newRange.end }, end: { $gte: newRange.start } }));
    },
    [range, currentView]
  );

  const events = useMemo<CalendarEvent[]>(
    () => datasource?.map?.(event => ({ ...event, title: event.name })) || [],
    [datasource]
  );

  return (
    <div ref={calendarRef}>
      <div style={{ height: window.innerHeight * 0.75 }}>
        <EventDetailPopover event={detailEvent} open={detailOpen} setOpen={setDetailOpen} onEdit={e => openForm(e as unknown as Record<string, unknown>)} />
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
    </div>
  );
};

export default EventCalendar;
