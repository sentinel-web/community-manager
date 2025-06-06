import { Card, Col, Row, Typography } from 'antd';
import PropTypes from 'prop-types';
import React from 'react';

export default function SectionCard({ children, title, ready, extra = <></> }) {
  return (
    <Card loading={!ready} type="inner" title={<SectionCardTitle title={title} />} extra={extra}>
      {children}
    </Card>
  );
}
SectionCard.propTypes = {
  children: PropTypes.node,
  title: PropTypes.string,
  ready: PropTypes.bool,
  extra: PropTypes.node,
};

function SectionCardTitle({ title }) {
  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Typography.Title level={2}>{title}</Typography.Title>
      </Col>
    </Row>
  );
}
SectionCardTitle.propTypes = {
  title: PropTypes.string,
};
