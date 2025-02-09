import React, { useEffect, useState } from 'react';
import TableActions from '../table/body/actions/TableActions';
import { Meteor } from 'meteor/meteor';
import { Tag } from 'antd';
import { getLegibleTextColor } from '../../helpers/color.helper';

export const SquadTags = ({ squadIds }) => {
  const [squadNames, setSquadNames] = useState([]);

  useEffect(() => {
    Meteor.callAsync('squads.options')
      .then(options => {
        const squadNames = options.filter(option => squadIds.includes(option.value)).map(option => option);
        setSquadNames(squadNames);
      })
      .catch(console.error);
  }, [squadIds]);

  return (
    <>
      {squadNames.map(squadName => (
        <Tag color={squadName.raw.color} key={squadName.value}>
          <span style={{ color: squadName.raw.color ? getLegibleTextColor(squadName.raw.color) : undefined }}>{squadName.label}</span>
        </Tag>
      ))}
    </>
  );
};

const getSquadsColumns = (handleEdit, handleDelete) => {
  return [
    {
      title: 'Image',
      dataIndex: 'image',
      key: 'image',
      render: image => (image ? <img src={image} alt="squad" width="50" height="50" /> : '-'),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => String(a.name).localeCompare(String(b.name)),
      render: (name, record) =>
        name ? (
          record.color ? (
            <Tag color={record.color}>
              <span style={{ color: getLegibleTextColor(record.color) }}>{name}</span>
            </Tag>
          ) : (
            <Tag>{name}</Tag>
          )
        ) : (
          '-'
        ),
    },
    {
      title: 'Short Range Frequency',
      dataIndex: 'shortRangeFrequency',
      key: 'shortRangeFrequency',
      sorter: (a, b) => String(a.shortRangeFrequency).localeCompare(String(b.shortRangeFrequency)),
      render: shortRangeFrequency => shortRangeFrequency || '-',
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      sorter: (a, b) => String(a.description).localeCompare(String(b.description)),
      render: description => (description ? <span style={{ whiteSpace: 'pre-wrap' }}>{description}</span> : '-'),
      ellipsis: true,
    },
    {
      title: 'Actions',
      dataIndex: 'actions',
      key: 'actions',
      render: (id, record) => <TableActions record={record} handleEdit={handleEdit} handleDelete={handleDelete} />,
    },
  ];
};

export default getSquadsColumns;
