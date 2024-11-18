import { Col, Row } from 'antd';
import React from 'react';

export default function Footer() {
  return (
    <footer>
      <Row gutter={[16, 16]}>
        <Col>© {new Date().getFullYear()}</Col>
      </Row>
    </footer>
  );
}
