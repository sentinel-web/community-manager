import React from 'react';
import { Card, Col, Row, Typography } from 'antd';

export default function SectionCard({ children, title, ready }) {
  return (
    <Card loading={!ready} type="inner" title={<SectionCardTitle title={title} />}>
      {children}
    </Card>
  );
}

function SectionCardTitle({ title }) {
  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Typography.Title level={2}>{title}</Typography.Title>
      </Col>
    </Row>
  );
}
