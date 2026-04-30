declare module 'react-big-calendar' {
  import type { ComponentType, CSSProperties, ReactNode } from 'react';

  export type View = 'month' | 'week' | 'day' | 'agenda';

  export interface DateRange {
    start: Date;
    end: Date;
  }

  export interface CalendarEvent {
    _id?: string;
    title?: ReactNode;
    start?: Date;
    end?: Date;
    allDay?: boolean;
    color?: string;
    eventType?: string;
    [key: string]: unknown;
  }

  export interface SlotInfo {
    start: Date;
    end: Date;
    slots: Date[];
    action: 'select' | 'click' | 'doubleClick';
  }

  export interface EventDropArg {
    event: CalendarEvent;
    start: Date;
    end: Date;
    allDay?: boolean;
  }

  export interface EventResizeArg {
    event: CalendarEvent;
    start: Date;
    end: Date;
    allDay?: boolean;
  }

  export interface DateLocalizerSpec {
    format: (value: Date, format: string, culture?: string) => string;
    startOfWeek: (culture?: string) => number;
  }

  export type DateLocalizer = DateLocalizerSpec;

  export interface CalendarProps {
    localizer: DateLocalizer;
    events?: CalendarEvent[];
    startAccessor?: string | ((event: CalendarEvent) => Date);
    endAccessor?: string | ((event: CalendarEvent) => Date);
    titleAccessor?: string | ((event: CalendarEvent) => string);
    formats?: Record<string, unknown>;
    messages?: Record<string, string>;
    draggableAccessor?: (event: CalendarEvent) => boolean;
    onEventDrop?: (args: EventDropArg) => void;
    onEventResize?: (args: EventResizeArg) => void;
    onDragEnd?: (args: { event: CalendarEvent }) => void;
    onSelectSlot?: (slotInfo: SlotInfo) => void;
    onSelectEvent?: (event: CalendarEvent, e: React.SyntheticEvent) => void;
    eventPropGetter?: (event: CalendarEvent) => { style?: CSSProperties; className?: string };
    onRangeChange?: (range: Date[] | DateRange, view?: View) => void;
    resizable?: boolean;
    selectable?: boolean;
    style?: CSSProperties;
  }

  export const Calendar: ComponentType<CalendarProps>;

  export function dayjsLocalizer(dayjs: unknown): DateLocalizer;
}

declare module 'react-big-calendar/lib/addons/dragAndDrop' {
  import type { ComponentType } from 'react';
  import type { CalendarProps } from 'react-big-calendar';

  function withDragAndDrop<T extends ComponentType<CalendarProps>>(component: T): T;
  export default withDragAndDrop;
}

declare module 'react-big-calendar/lib/addons/dragAndDrop/styles.css' {}
declare module 'react-big-calendar/lib/css/react-big-calendar.css' {}
