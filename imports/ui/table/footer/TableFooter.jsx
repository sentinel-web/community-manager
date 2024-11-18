import { Col, Row } from 'antd';
import React from 'react';

export default function TableFooter({ count = 0, ready = false }) {
  return (
    <Row gutter={[16, 16]}>
      <Col>Total: {!ready ? 'Loading...' : count}</Col>
    </Row>
  );
}
