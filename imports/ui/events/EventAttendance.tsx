import { EditFilled, SaveFilled } from '@ant-design/icons';
import { App, Button, Col, Row, Select, Tag } from 'antd';
import dayjs from 'dayjs';
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import React, { useEffect, useMemo, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import type { MemberPoints } from '../../api/attendance/points';
import { ATTENDANCE_STATUS_META, ATTENDANCE_STATUSES, isAttendanceStatus } from '../../api/attendance/status';
import AttendancesCollection from '../../api/collections/attendances.collection';
import MembersCollection from '../../api/collections/members.collection';
import RanksCollection from '../../api/collections/ranks.collection';
import type { AttendanceStatus } from '../../api/types/shared';
import type { EventDoc } from '../../api/types/event';
import { useTranslation } from '../../i18n/LanguageContext';
import useMethod from '../hooks/useMethod';
import type { TranslateFn } from '../section/types';
import TableContainer from '../table/body/TableContainer';
import Table from '../table/Table';
import { useTourRef } from '../tour/TourContext';

interface MemberNameProps {
  memberId: string;
  memberNameMap: Map<string, string>;
}

function MemberName({ memberId, memberNameMap }: MemberNameProps) {
  // Use pre-computed name from parent to avoid N+1 queries
  return <>{memberNameMap.get(memberId) || 'Unknown'}</>;
}

interface AttendanceOptionProps {
  value: AttendanceStatus;
  setEditting: React.Dispatch<React.SetStateAction<boolean>>;
}

function AttendanceOption({ value, setEditting }: AttendanceOptionProps) {
  const { t } = useTranslation();
  const { labelKey, tagColor } = ATTENDANCE_STATUS_META[value];

  return (
    <Row gutter={[4, 4]} align="middle">
      <Col>
        <Tag style={{ marginInlineEnd: 0 }} color={tagColor}>
          {t(labelKey)}
        </Tag>
      </Col>
      <Col>
        <Button size="small" icon={<EditFilled />} type="primary" variant="outlined" onClick={() => setEditting(prev => !prev)} />
      </Col>
    </Row>
  );
}

interface AttendanceSelectProps {
  value: AttendanceStatus | null | undefined;
  eventId: string;
  memberId: string;
  setEditting: React.Dispatch<React.SetStateAction<boolean>>;
}

function AttendanceSelect({ value, eventId, memberId, setEditting }: AttendanceSelectProps) {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const handleChange = async (newValue: AttendanceStatus) => {
    if (value === newValue) return;
    // Atomic server-side upsert keyed on { eventId } — replaces the former
    // read-then-write that raced into duplicate per-event rows (#261).
    try {
      await Meteor.callAsync('attendances.upsert', eventId, memberId, newValue);
    } catch (error) {
      const err = error as Meteor.Error;
      notification.error({ message: t('common.error'), description: err.reason || err.message });
    }
  };

  const options = useMemo(() => ATTENDANCE_STATUSES.map(status => ({ value: status, label: t(ATTENDANCE_STATUS_META[status].labelKey) })), [t]);

  return (
    <Row gutter={[4, 4]} align="middle">
      <Col>
        <Select
          value={value}
          onChange={handleChange}
          options={options}
          style={{ minWidth: 100, width: '100%' }}
          optionFilterProp="label"
          showSearch
        />
      </Col>
      <Col>
        <Button size="small" icon={<SaveFilled />} type="primary" variant="outlined" onClick={() => setEditting(prev => !prev)} />
      </Col>
    </Row>
  );
}

interface AttendanceRenderProps {
  value: AttendanceStatus | null | undefined;
  eventId: string;
  memberId: string;
}

function AttendanceRender({ value, eventId, memberId }: AttendanceRenderProps) {
  const [editting, setEditting] = useState(false);
  return editting || !isAttendanceStatus(value) ? (
    <AttendanceSelect value={value} eventId={eventId} memberId={memberId} setEditting={setEditting} />
  ) : (
    <AttendanceOption value={value} setEditting={setEditting} />
  );
}

interface AttendanceRow {
  _id: string;
  ip: number | null;
  points: number | null;
  memberId: string;
  [eventId: string]: AttendanceStatus | string | number | null | undefined;
}

function transformEventsIntoColumns(events: EventDoc[], memberNameMap: Map<string, string>, t: TranslateFn): ColumnsType<AttendanceRow> {
  const columns: ColumnsType<AttendanceRow> = [
    {
      title: t('common.name'),
      dataIndex: 'memberId',
      key: 'memberId',
      ellipsis: true,
      render: (memberId: string) => <MemberName memberId={memberId} memberNameMap={memberNameMap} />,
    },
    {
      title: t('events.inactivityPoints'),
      dataIndex: 'ip',
      key: 'ip',
      ellipsis: true,
      sorter: (a, b) => (a.ip ?? 0) - (b.ip ?? 0),
      render: (ip: number | null) => ip ?? '-',
    },
    {
      title: t('events.attendancePoints'),
      dataIndex: 'points',
      key: 'points',
      ellipsis: true,
      sorter: (a, b) => (a.points ?? 0) - (b.points ?? 0),
      render: (points: number | null) => points ?? '-',
    },
  ];
  columns.push(
    ...(events
      ?.sort?.((a, b) => (a.start as unknown as number) - (b.start as unknown as number))
      ?.map?.(event => ({
        title: dayjs(event.start).format('YYYY-MM-DD'),
        dataIndex: event._id as string,
        key: event._id as string,
        ellipsis: true,
        render: (value: AttendanceStatus | null | undefined, record: AttendanceRow) => (
          <AttendanceRender value={value} eventId={event._id as string} memberId={record.memberId} />
        ),
      })) || [])
  );
  return columns;
}

interface EventAttendanceProps {
  datasource: EventDoc[];
}

export default function EventAttendance({ datasource }: EventAttendanceProps) {
  const attendanceRef = useTourRef('events-attendance');
  const { t } = useTranslation();
  // Attendance grid needs all members and attendances for the selected events
  useSubscribe('attendances', { eventId: { $in: datasource.map(event => event._id) } }, { limit: 1000 });
  const attendances = useFind(() => AttendancesCollection.find({ eventId: { $in: datasource.map(event => event._id) as string[] } }), [datasource]);

  // Get unique attendee IDs from datasource events to filter members subscription
  const attendeeIds = useMemo(() => {
    const ids = new Set<string>();
    datasource.forEach(event => {
      (event.attendees || []).forEach(id => ids.add(id));
      (event.hosts || []).forEach(id => ids.add(id));
    });
    return [...ids];
  }, [datasource]);
  useSubscribe('members', attendeeIds.length ? { _id: { $in: attendeeIds } } : {}, {});
  const members = useFind(
    () =>
      MembersCollection.find(attendeeIds.length ? { _id: { $in: attendeeIds } } : {}, {
        sort: { 'profile.squadId': 1, 'profile.rankId': 1 },
      } as Mongo.Options<Meteor.User>),
    [attendeeIds]
  );
  useSubscribe('ranks', {}, {});
  const ranks = useFind(() => RanksCollection.find({}), []);

  // Pre-compute member names with ranks to avoid N+1 queries per row
  const memberNameMap = useMemo(() => {
    const rankNameById = new Map(ranks.map(r => [r._id, r.name]));
    return new Map(
      members.map(m => {
        const rankName = rankNameById.get(m.profile?.rankId as string) ?? '';
        const id = m.profile?.id ?? '';
        const name = m.profile?.name ?? '';
        return [m._id, `${rankName}-${id} "${name}"`];
      })
    );
  }, [members, ranks]);

  // The grid only loads the events in view, so IP/attendance points are the
  // members' true all-time totals from the server — the same calculation the
  // profile uses (#363). Refetched whenever members (static points) or the
  // loaded attendances change.
  const memberIds = useMemo(() => members.map(member => member._id), [members]);
  const { call: fetchPointsSummary } = useMethod<Record<string, MemberPoints>>('attendances.pointsSummary');
  const [pointsByMember, setPointsByMember] = useState<Record<string, MemberPoints>>({});
  useEffect(() => {
    if (!memberIds.length) return;
    let stale = false;
    fetchPointsSummary(memberIds).then(result => {
      if (!stale && result.ok) setPointsByMember(result.data);
    });
    return () => {
      stale = true;
    };
  }, [memberIds, attendances, fetchPointsSummary]);

  const columns = useMemo(() => transformEventsIntoColumns(datasource, memberNameMap, t), [datasource, memberNameMap, t]);
  const rows = useMemo(() => {
    return members.map(member => {
      const memberPoints = pointsByMember[member._id];
      return {
        _id: member._id,
        ip: memberPoints?.inactivityPoints ?? null,
        points: memberPoints?.attendancePoints ?? null,
        memberId: member._id,
        ...datasource.reduce<Record<string, AttendanceStatus | null | undefined>>((acc, event) => {
          const attendanceDoc = attendances.find(a => a.eventId === event._id);
          acc[event._id as string] = attendanceDoc ? (attendanceDoc[member._id] as AttendanceStatus | undefined) : undefined;
          return acc;
        }, {}),
      } as AttendanceRow;
    });
  }, [members, datasource, attendances, pointsByMember]);
  return (
    <div ref={attendanceRef}>
      <TableContainer>
        <Table columns={columns} datasource={rows} />
      </TableContainer>
    </div>
  );
}
