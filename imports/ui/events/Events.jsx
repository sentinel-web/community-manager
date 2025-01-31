import React from 'react';
import { Col, Row } from 'antd';
import SectionCard from '../section-card/SectionCard';
import EventCalendar from './EventCalendar';

export default function Events() {
  return (
    <SectionCard title="Events" ready={true}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <EventCalendar />
        </Col>
      </Row>
    </SectionCard>
  );
}
