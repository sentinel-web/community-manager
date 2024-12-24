import { App, Button, Col, Row } from 'antd';
import React, { useCallback } from 'react';

export default function TableActions({ record, handleDelete, handleEdit }) {
  const { modal } = App.useApp();
  const handleRemove = useCallback(
    e => {
      modal.confirm({
        title: 'Delete Entry',
        content: 'Are you sure you want to delete this entry?',
        okText: 'Yes',
        okType: 'danger',
        onOk: () => handleDelete(e, record),
        closable: true,
        maskClosable: true,
      });
    },
    [modal, handleDelete, record]
  );

  return (
    <Row gutter={[16, 16]}>
      <Col flex="auto">
        <Button onClick={e => handleEdit(e, record)}>Edit</Button>
      </Col>
      <Col flex="auto">
        <Button onClick={e => handleRemove(e, record)} danger>
          Delete
        </Button>
      </Col>
    </Row>
  );
}
