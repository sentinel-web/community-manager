import { Button, Col, Row } from 'antd';
import React from 'react';

export default function TableActions({ record, handleDelete, handleEdit }) {
  return (
    <Row gutter={[16, 16]}>
      <Col>
        <Button onClick={e => handleEdit(e, record)}>Edit</Button>
      </Col>
      <Col>
        <Button onClick={e => handleDelete(e, record)} danger>
          Delete
        </Button>
      </Col>
    </Row>
  );
}
