import { App, Button, Card, Col, Collapse, Descriptions, Row, Statistic, Tag, Typography } from 'antd';
import { Meteor } from 'meteor/meteor';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';
import type { LocaleKey } from '../../i18n';
import { useTourRef } from '../tour/TourContext';

// Closed maps from server-data keys to LocaleKeys. `as const satisfies` preserves
// the literal LocaleKey union per entry so t(MAP[k]) resolves to a paramless
// LocaleKey rather than the broad LocaleKey union (which would force a params arg).
// Falls back to the raw data key string at the call site if a server-supplied
// key isn't in the map — preserves pre-cutover defensive behavior.
export const STATS_LABEL_KEYS = {
  'event count': 'dashboard.stats.event count',
  'member count': 'dashboard.stats.member count',
  'member count by medal': 'dashboard.stats.member count by medal',
  'member count by rank': 'dashboard.stats.member count by rank',
  'member count by role': 'dashboard.stats.member count by role',
  'member count by specialization': 'dashboard.stats.member count by specialization',
  'member count by squad': 'dashboard.stats.member count by squad',
  'registrations by discovery type': 'dashboard.stats.registrations by discovery type',
  'registrations count': 'dashboard.stats.registrations count',
  'task count': 'dashboard.stats.task count',
  'task count by task status': 'dashboard.stats.task count by task status',
} as const satisfies Record<string, LocaleKey>;

export const PROFILE_LABEL_KEYS = {
  'attendance points': 'dashboard.profileLabels.attendance points',
  description: 'dashboard.profileLabels.description',
  'entry date': 'dashboard.profileLabels.entry date',
  id: 'dashboard.profileLabels.id',
  'inactivity points': 'dashboard.profileLabels.inactivity points',
  medals: 'dashboard.profileLabels.medals',
  name: 'dashboard.profileLabels.name',
  'profile picture': 'dashboard.profileLabels.profile picture',
  rank: 'dashboard.profileLabels.rank',
  role: 'dashboard.profileLabels.role',
  specializations: 'dashboard.profileLabels.specializations',
  squad: 'dashboard.profileLabels.squad',
} as const satisfies Record<string, LocaleKey>;

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
    <div ref={statsRef}>
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
            children: <ProfileStats profileStats={stats.profile} />,
          },
          {
            key: '2',
            label: t('dashboard.collectionStats'),
            children: (
              <Row gutter={[16, 16]}>
                {Object.entries(stats)
                  .filter(([key]) => key !== 'profile')
                  .map(([key, value]) => {
                    const translateStatKey = (k: string): string => {
                      const labelKey = STATS_LABEL_KEYS[k as keyof typeof STATS_LABEL_KEYS];
                      return labelKey ? t(labelKey) : k;
                    };
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
}

export function ProfileStats({ profileStats }: ProfileStatsProps) {
  const { t } = useTranslation();
  const fullWidthKeys = useMemo(() => ['description', 'specializations', 'medals'], []);
  const oneThirdWidthKeys = useMemo(() => ['rank', 'id', 'name', 'entry date', 'squad', 'role', 'attendance points', 'inactivity points'], []);

  const translateLabel = useCallback(
    (key: string): string => {
      const labelKey = PROFILE_LABEL_KEYS[key as keyof typeof PROFILE_LABEL_KEYS];
      return labelKey ? t(labelKey) : key;
    },
    [t],
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
                  ? (value as Specialization[]).map(spec =>
                      spec.linkToFile ? (
                        <a key={spec.name} href={spec.linkToFile} target="_blank" rel="noopener noreferrer">
                          <Tag color="blue" style={{ cursor: 'pointer' }}>{spec.name}</Tag>
                        </a>
                      ) : (
                        <Tag key={spec.name}>{spec.name}</Tag>
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
