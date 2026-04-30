import { EditFilled, SaveFilled } from '@ant-design/icons';
import { App, Button, Col, Row, Select, Tag } from 'antd';
import dayjs from 'dayjs';
import { Meteor } from 'meteor/meteor';
import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import React, { useMemo, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import AttendancesCollection from '../../api/collections/attendances.collection';
import MembersCollection from '../../api/collections/members.collection';
import RanksCollection from '../../api/collections/ranks.collection';
import type { AttendanceStatus } from '../../api/types/shared';
import type { EventDoc } from '../../api/types/event';
import { useTranslation } from '../../i18n/LanguageContext';
import type { TranslateFn } from '../section/types';
import type { TourElementRef } from '../tour/TourContext';
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
  const colorMap = useMemo<Record<string, string>>(() => {
    return {
      '-2': 'default',
      '-1': 'red',
      0: 'yellow',
      1: 'green',
      2: 'cyan',
    };
  }, []);
  const label = useMemo(() => {
    return {
      '-2': t('events.eventCancelled'),
      '-1': t('events.absent'),
      0: t('events.excused'),
      1: t('events.present'),
      2: t('events.presentZeus'),
    }[value];
  }, [value, t]);

  return (
    <Row gutter={[4, 4]} align="middle">
      <Col>
        <Tag style={{ marginInlineEnd: 0 }} color={colorMap[value]}>
          {label}
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
  const handleChange = (newValue: AttendanceStatus) => {
    if (value === newValue) return;
    Meteor.callAsync('attendances.read', { eventId }, { limit: 1 })
      .then(res => {
        const attendanceRes = res as Array<{ _id: string }>;
        const endpoint = attendanceRes.length ? 'attendances.update' : 'attendances.insert';
        const args = attendanceRes.length
          ? [attendanceRes[0]._id, { [memberId]: newValue }]
          : [{ eventId, [memberId]: newValue }];
        return Meteor.callAsync(endpoint, ...args);
      })
      .catch((error: Meteor.Error) => {
        notification.error({
          message: t('common.error'),
          description: error.reason || error.message,
        });
      });
  };

  const options = useMemo(
    () => [
      { value: -2 as AttendanceStatus, label: t('events.eventCancelled') },
      { value: -1 as AttendanceStatus, label: t('events.absent') },
      { value: 0 as AttendanceStatus, label: t('events.excused') },
      { value: 1 as AttendanceStatus, label: t('events.present') },
      { value: 2 as AttendanceStatus, label: t('events.presentZeus') },
    ],
    [t]
  );

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
  return editting || value === null || value === undefined ? (
    <AttendanceSelect value={value} eventId={eventId} memberId={memberId} setEditting={setEditting} />
  ) : (
    <AttendanceOption value={value} setEditting={setEditting} />
  );
}

interface AttendanceRow {
  _id: string;
  ip: number;
  points: number;
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
      sorter: (a, b) => (a.ip as number) - (b.ip as number),
    },
    {
      title: t('events.attendancePoints'),
      dataIndex: 'points',
      key: 'points',
      ellipsis: true,
      sorter: (a, b) => (a.points as number) - (b.points as number),
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
  const attendances = useFind(
    () => AttendancesCollection.find({ eventId: { $in: datasource.map(event => event._id) as string[] } } as never),
    [datasource]
  );

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
    () => MembersCollection.find(attendeeIds.length ? { _id: { $in: attendeeIds } } : {}, { sort: { squadId: 1, rankId: 1 } } as never),
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

  const columns = useMemo(() => transformEventsIntoColumns(datasource, memberNameMap, t), [datasource, memberNameMap, t]);
  const rows = useMemo(() => {
    return members.map(member => {
      let ip = (member.profile?.staticInactivityPoints as number) || 0;
      let points = (member.profile?.staticAttendancePoints as number) || 0;
      attendances.forEach(attendance => {
        const val = (attendance as unknown as Record<string, AttendanceStatus | undefined>)[member._id];
        if (val === -2 || val == null) return; // skip cancelled/missing
        if (val === -1) ip += 1;
        points += val === 2 ? 1 : Number(val);
      });
      return {
        _id: member._id,
        ip,
        points,
        memberId: member._id,
        ...datasource.reduce<Record<string, AttendanceStatus | null | undefined>>((acc, event) => {
          const attendanceDoc = attendances.find(a => (a as unknown as { eventId: string }).eventId === event._id);
          acc[event._id as string] = attendanceDoc
            ? (attendanceDoc as unknown as Record<string, AttendanceStatus>)[member._id]
            : undefined;
          return acc;
        }, {}),
      } as AttendanceRow;
    });
  }, [members, datasource, attendances]);
  return (
    <div ref={attendanceRef as React.RefObject<HTMLDivElement>}>
      <TableContainer>
        <Table columns={columns} datasource={rows} />
      </TableContainer>
    </div>
  );
}
