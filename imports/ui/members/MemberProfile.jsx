import { Card, Col, Descriptions, Progress, Row, Spin, Statistic, Typography } from 'antd';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';

export default function MemberProfile({ memberId }) {
  const { t } = useTranslation();
  const [profileStats, setProfileStats] = useState(null);
  const [access, setAccess] = useState({ canViewContact: false });
  const [breakdown, setBreakdown] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId) return;
    setLoading(true);
    Promise.all([
      Meteor.callAsync('members.profileStats', memberId),
      Meteor.callAsync('members.profileAccess', memberId),
      Meteor.callAsync('members.attendanceBreakdown', memberId),
    ])
      .then(([stats, accessResult, breakdownResult]) => {
        setProfileStats(stats);
        setAccess(accessResult);
        setBreakdown(breakdownResult);
      })
      .finally(() => setLoading(false));
  }, [memberId]);

  const attendancePercent = useMemo(() => {
    if (!breakdown?.total?.total) return 0;
    return Math.round(((breakdown.total.present + breakdown.total.zeus) / breakdown.total.total) * 100);
  }, [breakdown]);

  const quarterlyPercent = useMemo(() => {
    if (!breakdown?.quarterly?.total) return 0;
    return Math.round(((breakdown.quarterly.present + breakdown.quarterly.zeus) / breakdown.quarterly.total) * 100);
  }, [breakdown]);

  if (loading) {
    return (
      <Row justify="center" style={{ padding: 40 }}>
        <Spin size="large" />
      </Row>
    );
  }

  if (!profileStats) return null;

  return (
    <Row gutter={[16, 16]}>
      {/* Header: Profile Picture + Basic Info */}
      <Col xs={24} md={8}>
        <Card variant="outlined">
          <Row justify="center">
            <Col>
              {profileStats['profile picture'] && profileStats['profile picture'] !== '-' ? (
                <img
                  style={{ borderRadius: '50%', width: '100%', maxWidth: 200, maxHeight: 200 }}
                  src={profileStats['profile picture']}
                  alt={profileStats.name}
                />
              ) : (
                <div
                  style={{
                    borderRadius: '50%',
                    width: 200,
                    height: 200,
                    background: '#ccc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 48,
                  }}
                >
                  {profileStats.name?.[0] || '?'}
                </div>
              )}
            </Col>
          </Row>
          <Row justify="center" style={{ marginTop: 12 }}>
            <Typography.Title level={4} style={{ margin: 0 }}>
              {`${profileStats.rank}-${profileStats.id} "${profileStats.name}"`}
            </Typography.Title>
          </Row>
        </Card>
      </Col>

      {/* Info Section */}
      <Col xs={24} md={16}>
        <Descriptions
          layout="vertical"
          size="small"
          column={{ sm: 1, lg: 3 }}
          bordered
          items={[
            { label: t('members.squad'), children: profileStats.squad },
            { label: t('members.rank'), children: profileStats.rank },
            { label: t('members.entryDate'), children: profileStats['entry date'] },
            { label: t('columns.id'), children: profileStats.id },
            { label: t('common.name'), children: profileStats.name },
            { label: t('members.roles'), children: profileStats.role },
          ]}
        />
      </Col>

      {/* Stats */}
      <Col xs={24}>
        <Card title={t('events.attendance')} variant="outlined" size="small">
          <Row gutter={[16, 16]}>
            <Col xs={12} md={6}>
              <Statistic title={t('events.attendancePoints')} value={profileStats['attendance points']} />
            </Col>
            <Col xs={12} md={6}>
              <Statistic title={t('events.inactivityPoints')} value={profileStats['inactivity points']} />
            </Col>
            {breakdown && (
              <>
                <Col xs={12} md={6}>
                  <Statistic title={t('members.missionCount')} value={breakdown.missionCount} />
                </Col>
                <Col xs={12} md={6}>
                  <div>
                    <Typography.Text type="secondary">{t('members.attendanceOverall')}</Typography.Text>
                    <Progress percent={attendancePercent} size="small" />
                  </div>
                </Col>
                <Col xs={12} md={6}>
                  <div>
                    <Typography.Text type="secondary">{t('members.attendanceQuarterly')}</Typography.Text>
                    <Progress percent={quarterlyPercent} size="small" />
                  </div>
                </Col>
              </>
            )}
          </Row>
        </Card>
      </Col>

      {/* Qualifications */}
      <Col xs={24}>
        <Card title={t('members.qualifications')} variant="outlined" size="small">
          <Descriptions
            layout="vertical"
            size="small"
            column={1}
            bordered
            items={[
              { label: t('members.specializations'), children: profileStats.specializations || '-' },
              { label: t('members.medals'), children: profileStats.medals || '-' },
            ]}
          />
        </Card>
      </Col>

      {/* Description */}
      {profileStats.description && profileStats.description !== '-' && (
        <Col xs={24}>
          <Card title={t('common.description')} variant="outlined" size="small">
            <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{profileStats.description}</Typography.Paragraph>
          </Card>
        </Col>
      )}

      {/* Contact Info (conditionally shown) */}
      {access.canViewContact && (
        <Col xs={24}>
          <Card title={t('members.contactInfo')} variant="outlined" size="small">
            <Descriptions
              layout="vertical"
              size="small"
              column={{ sm: 1, lg: 2 }}
              bordered
              items={[
                {
                  label: t('members.steamProfile'),
                  children: profileStats.steamProfileLink ? (
                    <a href={profileStats.steamProfileLink} target="_blank" rel="noopener noreferrer">
                      {profileStats.steamProfileLink}
                    </a>
                  ) : (
                    '-'
                  ),
                },
                { label: t('members.discordTag'), children: profileStats.discordTag || '-' },
              ]}
            />
          </Card>
        </Col>
      )}
    </Row>
  );
}
MemberProfile.propTypes = {
  memberId: PropTypes.string,
};
