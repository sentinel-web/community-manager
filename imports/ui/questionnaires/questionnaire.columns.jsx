import { Button, Col, Tag } from 'antd';
import React from 'react';
import TableActions from '../table/body/actions/TableActions';

const STATUS_COLORS = {
  draft: 'default',
  active: 'success',
  closed: 'error',
};

const getQuestionnaireColumns = (handleEdit, handleDelete, permissions = {}, handleViewResponses = null) => {
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
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      sorter: (a, b) => (a.status || '').localeCompare(b.status || ''),
      render: status => <Tag color={STATUS_COLORS[status] || 'default'}>{status || 'draft'}</Tag>,
    },
    {
      title: 'Questions',
      dataIndex: 'questions',
      key: 'questions',
      sorter: (a, b) => (a.questions?.length || 0) - (b.questions?.length || 0),
      render: questions => questions?.length || 0,
    },
  ];

  const ViewResponsesExtra = handleViewResponses
    ? ({ record }) => (
        <Col flex="auto">
          <Button style={{ width: '100%' }} onClick={e => handleViewResponses(e, record)}>
            Responses
          </Button>
        </Col>
      )
    : null;

  if (canUpdate || canDelete || handleViewResponses) {
    columns.push({
      title: 'Actions',
      dataIndex: '_id',
      key: '_id',
      render: (id, record) => (
        <TableActions
          record={record}
          handleEdit={handleEdit}
          handleDelete={handleDelete}
          canUpdate={canUpdate}
          canDelete={canDelete}
          extra={ViewResponsesExtra}
        />
      ),
    });
  }

  return columns;
};

export default getQuestionnaireColumns;
