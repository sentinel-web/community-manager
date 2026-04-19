export type MemberId = string;
export type RoleId = string;
export type EventId = string;

export interface ColoredEntity {
  _id?: string;
  name: string;
  color?: string;
  description?: string;
}

export type AttendanceStatus = -2 | -1 | 0 | 1 | 2;

export interface Attendances {
  [eventId: string]: {
    [memberId: string]: AttendanceStatus;
  };
}
