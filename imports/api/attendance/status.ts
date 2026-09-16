import type { ParameterlessLocaleKey } from '../../i18n';
import type { AttendanceStatus } from '../types/shared';

/** Every attendance status, in the order the grid dropdown lists them. */
export const ATTENDANCE_STATUSES: readonly AttendanceStatus[] = [-2, -1, 0, 1, 2];

export interface AttendanceStatusMeta {
  labelKey: ParameterlessLocaleKey;
  /** antd Tag color — a preset name where one exists, else a hex. */
  tagColor: string;
  /** Chart fill — a hex that stays legible on light and dark backgrounds. */
  chartColor: string;
}

/**
 * The one status → { label, color } map (#365), shared by the attendance grid
 * tags, the grid dropdown, and the profile attendance pie chart.
 */
export const ATTENDANCE_STATUS_META: Readonly<Record<AttendanceStatus, AttendanceStatusMeta>> = {
  [-2]: { labelKey: 'events.eventCancelled', tagColor: '#000000', chartColor: '#000000' },
  [-1]: { labelKey: 'events.absent', tagColor: 'red', chartColor: '#f5222d' },
  0: { labelKey: 'events.excused', tagColor: 'gold', chartColor: '#faad14' },
  1: { labelKey: 'events.present', tagColor: 'green', chartColor: '#52c41a' },
  2: { labelKey: 'events.presentZeus', tagColor: 'blue', chartColor: '#1677ff' },
};

export function isAttendanceStatus(value: unknown): value is AttendanceStatus {
  return typeof value === 'number' && (ATTENDANCE_STATUSES as readonly number[]).includes(value);
}
