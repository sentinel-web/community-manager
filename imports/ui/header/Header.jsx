import { Col, Grid, Row } from 'antd';
import React from 'react';
import Logo from '../logo/Logo';
import Navigation from '../navigation/Navigation';
import useSettings from '../settings/settings.hook';
import Title from '../title/Title';

export default function Header() {
  const { communityTitle, communityLogo } = useSettings();
  const breakpoints = Grid.useBreakpoint();

  return (
    <Row gutter={[16, 16]} align="middle" style={{ flexWrap: 'nowrap' }}>
      <Col flex="auto">
        <Row gutter={[16, 16]} align="middle" style={{ flexWrap: 'nowrap' }}>
          <Col>
            <Logo src={communityLogo} />
          </Col>
          {breakpoints.lg && (
            <Col flex="auto">
              <Title text={communityTitle?.length > 0 ? communityTitle : undefined} />
            </Col>
          )}
        </Row>
      </Col>
      <Col>
        <Navigation />
      </Col>
    </Row>
  );
}
