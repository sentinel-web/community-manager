import React, { useEffect, useState } from 'react';
import TableActions from '../table/body/actions/TableActions';
import RankTag from '../members/ranks/RankTag';
import { Participants } from '../tasks/task.columns';
import { Meteor } from 'meteor/meteor';
import { Tag } from 'antd';

const SpecializationTags = ({ specializations }) => {
  const [values, setValues] = useState('loading...');
  useEffect(() => {
    if (!specializations?.length) setValues([]);
    Meteor.callAsync('specializations.options')
      .then(res => {
        const data = res.filter(option => specializations.includes(option.value)).map(option => option);
        setValues(data);
      })
      .catch(console.error);
  }, [specializations]);

  if (!Array.isArray(values)) return values;
  if (!values.length) return '-';

  return (
    <>
      {values.length > 0
        ? values.map(value => (
            <Tag style={{ marginRight: 4 }} key={value.value} color={value.raw.color}>
              {value.label}
            </Tag>
          ))
        : '-'}
    </>
  );
};

const getSpecializationColumns = (handleEdit, handleDelete) => {
  return [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      sorter: (a, b) => String(a.name).localeCompare(String(b.name)),
      render: (name, record) => (name ? record.color ? <Tag color={record.color}>{name}</Tag> : <Tag>{name}</Tag> : '-'),
    },
    {
      title: 'Instructors',
      dataIndex: 'instructors',
      key: 'instructors',
      ellipsis: true,
      sorter: (a, b) => {
        const instructorsA = a.instructors || [];
        const instructorsB = b.instructors || [];
        return instructorsA.length - instructorsB.length;
      },
      render: instructors => (instructors ? <Participants participants={instructors} /> : '-'),
    },
    {
      title: 'Required Rank',
      dataIndex: 'requiredRankId',
      key: 'requiredRankId',
      ellipsis: true,
      render: requiredRankId => (requiredRankId ? <RankTag rankId={requiredRankId} /> : '-'),
    },
    {
      title: 'Required Specializations',
      dataIndex: 'requiredSpecializations',
      key: 'requiredSpecializations',
      ellipsis: true,
      sorter: (a, b) => {
        const requiredSpecializationsA = a.requiredSpecializations || [];
        const requiredSpecializationsB = b.requiredSpecializations || [];
        return requiredSpecializationsA.length - requiredSpecializationsB.length;
      },
      render: requiredSpecializations => (requiredSpecializations ? <SpecializationTags specializations={requiredSpecializations} /> : '-'),
    },
    {
      title: 'Link to File',
      dataIndex: 'linkToFile',
      key: 'linkToFile',
      ellipsis: true,
      sorter: (a, b) => String(a.linkToFile).localeCompare(String(b.linkToFile)),
      render: linkToFile =>
        linkToFile ? (
          <a href={linkToFile} target="_blank" rel="noreferrer" title={linkToFile}>
            Link
          </a>
        ) : (
          '-'
        ),
    },
    {
      title: 'Actions',
      dataIndex: '_id',
      key: '_id',
      render: (id, record) => <TableActions record={record} handleEdit={handleEdit} handleDelete={handleDelete} />,
    },
  ];
};

export default getSpecializationColumns;
