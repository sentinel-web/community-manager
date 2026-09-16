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
import { getCalendarRange, getInitialCalendarView } from './eventFilter';

const DnDCalendar = withDragAndDrop(Calendar);

interface EventCalendarProps {
  datasource?: EventDoc[];
  // Reports the visible date range (on mount and on every navigation/view
  // change) so the owner can filter the events it passes back in.
  onRangeChange?: (start: Date, end: Date) => void;
}

const EventCalendar = ({ datasource, onRangeChange }: EventCalendarProps) => {
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

  // Default to the agenda list below the mobile breakpoint — react-big-calendar's
  // month grid is unreadable on a phone. Read once at mount; the user can switch
  // views afterwards via the (controlled) toolbar.
  const [currentView, setCurrentView] = useState<View>(getInitialCalendarView);

  // react-big-calendar only reports ranges on navigation, so report the
  // initial one on mount. It corrects the range the owner predicted when it
  // switched to this view. Later ranges come from handleRangeChange.
  useEffect(() => {
    const [start, end] = getCalendarRange(getInitialCalendarView(), dayjs());
    onRangeChange?.(start.toDate(), end.toDate());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: the calendar starts on today's date in the initial view
  }, []);

  const handleRangeChange = useCallback(
    (value: Date[] | DateRange, view?: View) => {
      // Day/week views pass the visible days, month/agenda a { start, end } range.
      const [first, last] = Array.isArray(value) ? [value[0], value[value.length - 1]] : [value.start, value.end];
      if (view) setCurrentView(view);
      onRangeChange?.(dayjs(first).startOf('day').toDate(), dayjs(last).endOf('day').toDate());
    },
    [onRangeChange]
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
          view={currentView}
          onView={setCurrentView}
          resizable
          selectable
        />
      </div>
    </div>
  );
};

export default EventCalendar;
