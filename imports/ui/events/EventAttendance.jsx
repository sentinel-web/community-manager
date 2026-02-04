import { EditFilled, SaveFilled } from '@ant-design/icons';
import { Button, Col, Row, Select, Tag } from 'antd';
import dayjs from 'dayjs';
import { Meteor } from 'meteor/meteor';
import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import PropTypes from 'prop-types';
import React, { useEffect, useMemo, useState } from 'react';
import AttendancesCollection from '../../api/collections/attendances.collection';
import MembersCollection from '../../api/collections/members.collection';
import TableContainer from '../table/body/TableContainer';
import Table from '../table/Table';

function MemberName({ memberId }) {
  const [name, setName] = useState('loading...');
  useEffect(() => {
    Meteor.callAsync('members.read', { _id: memberId }, { limit: 1 }).then(members => {
      Meteor.callAsync('ranks.read', { _id: members?.[0]?.profile?.rankId ?? null }, { limit: 1 }).then(ranks => {
        setName(`${ranks?.[0]?.name ?? ''}-${members?.[0]?.profile?.id ?? ''} "${members?.[0]?.profile?.name ?? ''}"`);
      });
    });
  }, [memberId]);
  return name;
}

function AttendanceOption({ value, setEditting }) {
  const colorMap = useMemo(() => {
    return {
      '-1': 'red',
      0: 'yellow',
      1: 'green',
    };
  }, []);
  const label = useMemo(() => {
    return {
      '-1': 'Absent (No Show)',
      0: 'Excused',
      1: 'Present',
    }[value];
  }, [value]);

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
AttendanceOption.propTypes = {
  value: PropTypes.number,
  setEditting: PropTypes.func,
};

function AttendanceSelect({ value, eventId, memberId, setEditting }) {
  const handleChange = newValue => {
    if (value === newValue) return;
    Meteor.callAsync('attendances.read', { eventId }, { limit: 1 }).then(res => {
      const endpoint = res.length ? 'attendances.update' : 'attendances.insert';
      const args = res.length ? [res[0]._id, { [memberId]: newValue }] : [{ eventId, [memberId]: newValue }];
      Meteor.callAsync(endpoint, ...args)
        .then(console.log)
        .catch(console.error);
    });
  };

  return (
    <Row gutter={[4, 4]} align="middle">
      <Col>
        <Select
          value={value}
          onChange={handleChange}
          options={[
            { value: -1, label: 'Absent (No Show)' },
            { value: 0, label: 'Excused' },
            { value: 1, label: 'Present' },
          ]}
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
AttendanceSelect.propTypes = {
  value: PropTypes.number,
  eventId: PropTypes.string,
  memberId: PropTypes.string,
  setEditting: PropTypes.func,
};

function AttendanceRender({ value, eventId, memberId }) {
  const [editting, setEditting] = useState(false);
  return editting || value == null ? (
    <AttendanceSelect value={value} eventId={eventId} memberId={memberId} setEditting={setEditting} />
  ) : (
    <AttendanceOption value={value} setEditting={setEditting} />
  );
}
AttendanceRender.propTypes = {
  value: PropTypes.number,
  eventId: PropTypes.string,
  memberId: PropTypes.string,
};

function transformEventsIntoColumns(events) {
  const columns = [
    {
      title: 'Name',
      dataIndex: 'memberId',
      key: 'memberId',
      ellipsis: true,
      render: memberId => <MemberName memberId={memberId} />,
    },
    {
      title: 'IP (Inactivity Points)',
      dataIndex: 'ip',
      key: 'ip',
      ellipsis: true,
      sorter: (a, b) => a.ip - b.ip,
    },
    {
      title: 'Attendance Points',
      dataIndex: 'points',
      key: 'points',
      ellipsis: true,
      sorter: (a, b) => a.points - b.points,
    },
  ];
  columns.push(
    ...(events
      ?.sort?.((a, b) => a.start - b.start)
      ?.map?.(event => {
        return {
          title: dayjs(event.start).format('YYYY-MM-DD'),
          dataIndex: event._id,
          key: event._id,
          ellipsis: true,
          render: (value, record) => <AttendanceRender value={value} eventId={event._id} memberId={record.memberId} />,
        };
      }) || [])
  );
  return columns;
}

export default function EventAttendance({ datasource }) {
  const columns = useMemo(() => transformEventsIntoColumns(datasource), [datasource]);
  // Attendance grid needs all members and attendances for the selected events
  useSubscribe('attendances', { eventId: { $in: datasource.map(event => event._id) } }, { limit: 1000 });
  const attendances = useFind(() => AttendancesCollection.find({ eventId: { $in: datasource.map(event => event._id) } }), [datasource]);
  useSubscribe('members', {}, { limit: 1000 });
  const members = useFind(() => MembersCollection.find({}, { sort: { squadId: 1, rankId: 1 } }), []);
  const rows = useMemo(() => {
    return members.map(member => {
      return {
        _id: member._id,
        ip: (member.profile.staticInactivityPoints || 0) + (attendances.filter(attendance => attendance[member._id] === -1).length || 0),
        points:
          (member.profile.staticAttendancePoints || 0) +
          (attendances.reduce((acc, attendance) => acc + (attendance[member._id] != null ? Number(attendance[member._id]) : 0), 0) || 0),
        memberId: member._id,
        ...datasource.reduce((acc, event) => {
          acc[event._id] = attendances.find(attendance => attendance.eventId === event._id)?.[member._id];
          return acc;
        }, {}),
      };
    });
  }, [members, datasource, attendances]);
  return (
    <TableContainer>
      <Table columns={columns} datasource={rows} />
    </TableContainer>
  );
}
EventAttendance.propTypes = {
  datasource: PropTypes.array,
};
