import React from "react";
import Logo from "../logo/Logo";
import Title from "../title/Title";
import Navigation from "../navigation/Navigation";
import useSettings from "../settings/settings.hook";
import { Col, Row } from "antd";

export default function Header() {
  const { communityTitle, communityLogo } = useSettings();

  return (
    <Row gutter={[16, 16]} align="middle">
      <Col flex="auto">
        <Row gutter={[16, 16]} align="middle">
          <Col>
            <Logo src={communityLogo} />
          </Col>
          <Col flex="auto">
            <Title
              text={communityTitle?.length > 0 ? communityTitle : undefined}
            />
          </Col>
        </Row>
      </Col>
      <Col>
        <Navigation />
      </Col>
    </Row>
  );
}
