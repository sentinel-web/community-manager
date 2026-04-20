import { Col, Row } from 'antd';
import React, { ReactNode } from 'react';

interface TableContainerProps {
  children?: ReactNode;
}

export default function TableContainer({ children }: TableContainerProps) {
  return (
    <Row gutter={[16, 16]}>
      <Col span={24} className="table-container">
        {children}
      </Col>
    </Row>
  );
}
