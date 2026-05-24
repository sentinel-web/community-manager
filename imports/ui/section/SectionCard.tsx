import { Card, Col, Row, Typography } from 'antd';
import React, { ReactNode } from 'react';

interface SectionCardProps {
  children?: ReactNode;
  title?: string;
  ready?: boolean;
  extra?: ReactNode;
}

export default function SectionCard({ children, title, ready, extra = <></> }: SectionCardProps) {
  return (
    <Card loading={!ready} type="inner" title={<SectionCardTitle title={title} />} extra={extra}>
      {children}
    </Card>
  );
}

interface SectionCardTitleProps {
  title?: string;
}

function SectionCardTitle({ title }: SectionCardTitleProps) {
  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Typography.Title level={2} ellipsis={{ tooltip: title }} style={{ marginBottom: 0 }}>
          {title}
        </Typography.Title>
      </Col>
    </Row>
  );
}
