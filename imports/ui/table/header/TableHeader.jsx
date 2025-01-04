import { Button, Col, Input, Row } from 'antd';
import React from 'react';

export default function TableHeader({ handleChange = console.warn, value = '', handleCreate = console.warn }) {
  return (
    <Row gutter={[16, 16]}>
      <Col flex="auto">
        <Input.Search placeholder="Search..." value={value} onChange={handleChange} />
      </Col>
      <Col>
        <Button type="primary" onClick={handleCreate}>
          Create
        </Button>
      </Col>
    </Row>
  );
}
