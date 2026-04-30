import { App, Button, Card, Col, Collapse, Descriptions, Row, Statistic, Tag, Typography } from 'antd';
import { Meteor } from 'meteor/meteor';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { LanguageContextValue } from '../../i18n/LanguageContext';
import { useTranslation } from '../../i18n/LanguageContext';
import { useTourRef } from '../tour/TourContext';

interface Specialization {
  name: string;
  linkToFile: string | null;
}

interface ProfileStatsData {
  'profile picture'?: string;
  name?: string;
  id?: number | string;
  rank?: string;
  rankColor?: string | null;
  navyRank?: string;
  squad?: string;
  role?: string;
  'entry date'?: string;
  'attendance points'?: number;
  'inactivity points'?: number;
  description?: string;
  specializations?: Specialization[];
  medals?: string;
  steamProfileLink?: string;
  discordTag?: string;
  position?: string;
  positionColor?: string | null;
}

interface DashboardStats {
  profile?: ProfileStatsData;
  [key: string]: number | Record<string, number> | ProfileStatsData | undefined;
}

export default function Dashboard() {
  const { message } = App.useApp();
  const [stats, setStats] = useState<DashboardStats>({});
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  const statsRef = useTourRef('dashboard-stats');
  const fetchStats = useCallback(function () {
    setLoading(true);
    Meteor.callAsync('dashboard.stats')
      .then((data: DashboardStats) => setStats(data))
      .catch(() => {
        message.error('Failed to load dashboard stats');
      })
      .finally(() => setLoading(false));
  }, [message]);
  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div ref={statsRef as React.RefObject<HTMLDivElement>}>
      <Card
        type="inner"
        loading={loading}
        title={
        <Row justify="space-between" align="middle">
          <Col>
            <Typography.Title level={3}>{t('dashboard.title')}</Typography.Title>
          </Col>
          <Col>
            <Button disabled={loading} onClick={fetchStats} type="primary">
              {t('dashboard.refresh')}
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
            label: t('dashboard.yourProfile'),
            children: <ProfileStats profileStats={stats.profile} t={t} />,
          },
          {
            key: '2',
            label: t('dashboard.collectionStats'),
            children: (
              <Row gutter={[16, 16]}>
                {Object.entries(stats)
                  .filter(([key]) => key !== 'profile')
                  .map(([key, value]) => {
                    const translateStatKey = (k: string) => t(`dashboard.stats.${k}`) || k;
                    return typeof value === 'object' ? (
                      Object.keys(value as Record<string, number>).map(childKey => (
                        <Col xs={24} md={12} lg={8} xxl={6} key={childKey}>
                          <Card variant="outlined">
                            <Statistic title={`${translateStatKey(key)}: ${childKey}`} value={(value as Record<string, number>)[childKey]} />
                          </Card>
                        </Col>
                      ))
                    ) : (
                      <Col xs={24} md={12} lg={8} xxl={6} key={key}>
                        <Card variant="outlined">
                          <Statistic title={translateStatKey(key)} value={value as number} />
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
    </div>
  );
}

interface ProfileStatsProps {
  profileStats?: ProfileStatsData;
  t: LanguageContextValue['t'];
}

export function ProfileStats({ profileStats, t }: ProfileStatsProps) {
  const fullWidthKeys = useMemo(() => ['description', 'specializations', 'medals'], []);
  const oneThirdWidthKeys = useMemo(() => ['rank', 'id', 'name', 'entry date', 'squad', 'role', 'attendance points', 'inactivity points'], []);

  const translateLabel = useCallback(
    (key: string) => (t ? t(`dashboard.profileLabels.${key}`) : key),
    [t]
  );

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
              label: translateLabel(key),
              children: value as React.ReactNode,
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
              label: translateLabel(key),
              children:
                key === 'specializations' && Array.isArray(value) && value.length > 0
                  ? (value as Specialization[]).map((spec, i) =>
                      spec.linkToFile ? (
                        <a key={i} href={spec.linkToFile} target="_blank" rel="noopener noreferrer">
                          <Tag color="blue" style={{ cursor: 'pointer' }}>{spec.name}</Tag>
                        </a>
                      ) : (
                        <Tag key={i}>{spec.name}</Tag>
                      )
                    )
                  : key === 'specializations'
                    ? '-'
                    : value as React.ReactNode,
            }))}
          bordered
        />
      </Col>
    </Row>
  );
}
