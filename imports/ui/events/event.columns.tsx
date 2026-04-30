import React from 'react';
import TableActions from '../table/body/actions/TableActions';

/**
 * Factory function to generate table columns for events.
 * @param {function} handleEdit - Callback function to handle editing an event. Called with (event, record).
 * @param {function} handleDelete - Callback function to handle deleting an event. Called with (event, record).
 * @param {object} [permissions={}] - Permission flags for the current user.
 * @param {boolean} [permissions.canUpdate=true] - Whether the user can update events.
 * @param {boolean} [permissions.canDelete=true] - Whether the user can delete events.
 * @param {function} [t=k=>k] - Translation function for i18n.
 * @returns {Array} Array of column configuration objects for Ant Design Table.
 */
const getEventColumns = (handleEdit, handleDelete, permissions = {}, t = k => k) => {
  const { canUpdate = true, canDelete = true } = permissions;

  const columns = [
    {
      title: t('common.name'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
    },
    {
      title: t('common.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      sorter: (a, b) => (a.description || '').localeCompare(b.description || ''),
    },
  ];

  // Only add Actions column if user has update or delete permission
  if (canUpdate || canDelete) {
    columns.push({
      title: t('common.actions'),
      dataIndex: '_id',
      key: '_id',
      render: (id, record) => (
        <TableActions record={record} handleEdit={handleEdit} handleDelete={handleDelete} canUpdate={canUpdate} canDelete={canDelete} />
      ),
    });
  }

  return columns;
};

export default getEventColumns;
