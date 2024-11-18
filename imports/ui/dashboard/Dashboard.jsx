import React from 'react';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import { Button, Col, Row, Typography } from 'antd';
import SectionCard from '../section-card/SectionCard';

export default function Dashboard() {
  const [username, setUsername] = React.useState('loading...');

  const user = useTracker(() => {
    return Meteor.user();
  }, []);

  React.useEffect(() => {
    if (user) {
      setUsername(user.username);
    } else {
      setUsername('loading...');
    }
  }, [user]);

  function handleLogout(e) {
    e.preventDefault();
    Meteor.logout();
  }

  return (
    <SectionCard title="Dashboard" ready={!!user}>
      <Row gutter={[16, 16]} align="middle">
        <Col flex="auto">
          <Typography.Title level={3}>Welcome back, {username}!</Typography.Title>
        </Col>
        <Col>
          <Button onClick={handleLogout} type="primary" title="Logout">
            Logout
          </Button>
        </Col>
      </Row>
    </SectionCard>
  );
}
