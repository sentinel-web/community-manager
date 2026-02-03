import { Tag } from 'antd';
import React from 'react';
import TableActions from '../../table/body/actions/TableActions';

/**
 * Factory function to generate table columns for medals.
 * @param {function} handleEdit - Callback function to handle editing a medal. Called with (event, record).
 * @param {function} handleDelete - Callback function to handle deleting a medal. Called with (event, record).
 * @param {object} [permissions={}] - Permission flags for the current user.
 * @param {boolean} [permissions.canUpdate=true] - Whether the user can update medals.
 * @param {boolean} [permissions.canDelete=true] - Whether the user can delete medals.
 * @returns {Array} Array of column configuration objects for Ant Design Table.
 */
const getMedalColumns = (handleEdit, handleDelete, permissions = {}) => {
  const { canUpdate = true, canDelete = true } = permissions;

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      sorter: (a, b) => (a.description || '').localeCompare(b.description || ''),
    },
    {
      title: 'Color',
      dataIndex: 'color',
      key: 'color',
      ellipsis: true,
      sorter: (a, b) => (a.color || '').localeCompare(b.color || ''),
      render: color => <Tag color={color || 'transparent'}>{color}</Tag>,
    },
  ];

  if (canUpdate || canDelete) {
    columns.push({
      title: 'Actions',
      dataIndex: '_id',
      key: '_id',
      render: (id, record) => (
        <TableActions record={record} handleEdit={handleEdit} handleDelete={handleDelete} canUpdate={canUpdate} canDelete={canDelete} />
      ),
    });
  }

  return columns;
};

export default getMedalColumns;
