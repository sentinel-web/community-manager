import { Col, Grid, Row } from 'antd';
import React, { useEffect } from 'react';
import Logo from '../logo/Logo';
import Navigation from '../navigation/Navigation';
import LanguageSelector from '../components/LanguageSelector';
import useSettings from '../settings/settings.hook';
import Title from '../title/Title';

export default function Header() {
  const { communityTitle, communityLogo } = useSettings();
  const breakpoints = Grid.useBreakpoint();

  useEffect(() => {
    if (communityLogo) {
      document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]').forEach(link => {
        link.href = communityLogo;
      });
    }
  }, [communityLogo]);

  useEffect(() => {
    if (communityTitle) {
      document.title = communityTitle;
    }
  }, [communityTitle]);

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
        <LanguageSelector />
      </Col>
      <Col>
        <Navigation />
      </Col>
    </Row>
  );
}
