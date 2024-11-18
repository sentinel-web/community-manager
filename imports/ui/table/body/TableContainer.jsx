import { Col, Row } from 'antd';
import React from 'react';

export default function TableContainer({ children }) {
  return (
    <Row gutter={[16, 16]}>
      <Col span={24} className="table-container">
        {children}
      </Col>
    </Row>
  );
}
