import { Button, Card, Col, Collapse, Descriptions, Row, Statistic, Typography } from 'antd';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

export default function Dashboard() {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const fetchStats = useCallback(function () {
    setLoading(true);
    Meteor.callAsync('dashboard.stats')
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <Card
      type="inner"
      loading={loading}
      title={
        <Row justify="space-between" align="middle">
          <Col>
            <Typography.Title level={3}>Dashboard</Typography.Title>
          </Col>
          <Col>
            <Button disabled={loading} onClick={fetchStats} type="primary">
              Refresh
            </Button>
          </Col>
        </Row>
      }
    >
      <Collapse
        defaultActiveKey={['1', '2']}
        items={[
          {
            key: '1',
            label: 'Your Profile',
            children: <ProfileStats profileStats={stats.profile} />,
          },
          {
            key: '2',
            label: 'Collection Stats',
            children: (
              <Row gutter={[16, 16]}>
                {Object.entries(stats)
                  .filter(([key]) => key !== 'profile')
                  .map(([key, value]) => {
                    return typeof value === 'object' ? (
                      Object.keys(value).map(childKey => (
                        <Col xs={24} md={12} lg={8} xxl={6} key={childKey}>
                          <Card variant="outlined">
                            <Statistic title={`${key}: ${childKey}`} value={value[childKey]} />
                          </Card>
                        </Col>
                      ))
                    ) : (
                      <Col xs={24} md={12} lg={8} xxl={6} key={key}>
                        <Card variant="outlined">
                          <Statistic title={key} value={value} />
                        </Card>
                      </Col>
                    );
                  })}
              </Row>
            ),
          },
        ]}
      />
    </Card>
  );
}

export function ProfileStats({ profileStats }) {
  const fullWidthKeys = useMemo(() => ['description', 'specializations', 'medals'], []);
  const oneThirdWidthKeys = useMemo(() => ['rank', 'id', 'name', 'entry date', 'squad', 'role', 'attendance points', 'inactivity points'], []);

  return (
    <Row gutter={[16, 16]} justify="center" align="middle">
      <Col xs={24} lg={8} xl={6} xxl={4}>
        <Card variant="outlined">
          <Row justify="center">
            <Col>
              <img
                style={{ borderRadius: '50%', height: '100%', width: '100%', maxWidth: 200, maxHeight: 200 }}
                src={profileStats?.['profile picture']}
                alt={`profile picture of ${profileStats?.name}`}
              />
            </Col>
          </Row>
        </Card>
      </Col>
      <Col xs={24} lg={16} xl={18} xxl={20}>
        <Descriptions
          layout="vertical"
          size="small"
          column={{
            sm: 1,
            lg: 3,
          }}
          items={Object.entries(profileStats ?? {})
            .filter(([key]) => oneThirdWidthKeys.includes(key))
            .map(([key, value]) => ({
              label: key,
              children: value,
            }))}
          bordered
        />
      </Col>
      <Col span={24}>
        <Descriptions
          layout="vertical"
          size="small"
          column={1}
          styles={{
            content: { whiteSpace: 'pre-wrap' },
          }}
          items={Object.entries(profileStats ?? {})
            .filter(([key]) => fullWidthKeys.includes(key))
            .map(([key, value]) => ({
              label: key,
              children: value,
            }))}
          bordered
        />
      </Col>
    </Row>
  );
}
ProfileStats.propTypes = {
  profileStats: PropTypes.object,
};
