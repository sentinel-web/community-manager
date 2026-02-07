import { App, Button, Card, Col, Descriptions, Modal, Row, Select, Spin, Statistic, Tag, Typography } from 'antd';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useTranslation } from '../../i18n/LanguageContext';

const ATTENDANCE_COLORS = { present: '#52c41a', zeus: '#1890ff', excused: '#faad14', absent: '#ff4d4f' };

function AttendancePieChart({ data, title }) {
  const chartData = [
    { name: 'Present', value: data.present, color: ATTENDANCE_COLORS.present },
    { name: 'Zeus', value: data.zeus, color: ATTENDANCE_COLORS.zeus },
    { name: 'Excused', value: data.excused, color: ATTENDANCE_COLORS.excused },
    { name: 'Absent', value: data.absent, color: ATTENDANCE_COLORS.absent },
  ].filter(d => d.value > 0);

  if (!chartData.length) return <Typography.Text type="secondary">{title}: -</Typography.Text>;

  return (
    <div>
      <Typography.Text type="secondary">{title}</Typography.Text>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
AttendancePieChart.propTypes = {
  data: PropTypes.object,
  title: PropTypes.string,
};

export default function MemberProfile({ memberId }) {
  const { t } = useTranslation();
  const { message, notification } = App.useApp();
  const [profileStats, setProfileStats] = useState(null);
  const [access, setAccess] = useState({ canViewContact: false });
  const [breakdown, setBreakdown] = useState(null);
  const [loading, setLoading] = useState(true);
  const [specModalOpen, setSpecModalOpen] = useState(false);
  const [specOptions, setSpecOptions] = useState([]);
  const [selectedSpec, setSelectedSpec] = useState(null);

  const isOwnProfile = useMemo(() => memberId === Meteor.userId(), [memberId]);

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

  const handleRequestSpec = useCallback(async () => {
    if (!selectedSpec) return;
    try {
      await Meteor.callAsync('specializations.request', selectedSpec);
      message.success(t('messages.specializationRequested'));
      setSpecModalOpen(false);
      setSelectedSpec(null);
    } catch (error) {
      notification.error({ message: error.error, description: error.message });
    }
  }, [selectedSpec, message, notification, t]);

  const openSpecModal = useCallback(async () => {
    try {
      const options = await Meteor.callAsync('specializations.options');
      setSpecOptions(options);
      setSpecModalOpen(true);
    } catch (error) {
      notification.error({ message: error.error, description: error.message });
    }
  }, [notification]);

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
                    background: profileStats.rankColor || '#ccc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 48,
                    color: '#fff',
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
            { label: t('forms.labels.navyRank'), children: profileStats.navyRank },
            { label: t('members.entryDate'), children: profileStats['entry date'] },
            { label: t('columns.id'), children: profileStats.id },
            { label: t('common.name'), children: profileStats.name },
            { label: t('members.roles'), children: profileStats.role },
            ...(profileStats.position && profileStats.position !== '-'
              ? [{ label: t('members.position'), children: profileStats.position }]
              : []),
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
                <Col xs={24} md={12}>
                  <AttendancePieChart data={breakdown.total} title={t('members.attendanceOverall')} />
                </Col>
                <Col xs={24} md={12}>
                  <AttendancePieChart data={breakdown.quarterly} title={t('members.attendanceQuarterly')} />
                </Col>
              </>
            )}
          </Row>
        </Card>
      </Col>

      {/* Qualifications */}
      <Col xs={24}>
        <Card
          title={t('members.qualifications')}
          variant="outlined"
          size="small"
          extra={isOwnProfile && <Button size="small" onClick={openSpecModal}>{t('members.requestSpecialization')}</Button>}
        >
          <Descriptions
            layout="vertical"
            size="small"
            column={1}
            bordered
            items={[
              {
                label: t('members.specializations'),
                children: Array.isArray(profileStats.specializations) && profileStats.specializations.length > 0
                  ? profileStats.specializations.map((spec, i) =>
                      spec.linkToFile ? (
                        <a key={i} href={spec.linkToFile} target="_blank" rel="noopener noreferrer">
                          <Tag color="blue" style={{ cursor: 'pointer' }}>{spec.name}</Tag>
                        </a>
                      ) : (
                        <Tag key={i}>{spec.name}</Tag>
                      )
                    )
                  : '-',
              },
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

      {/* Request Specialization Modal */}
      <Modal
        title={t('members.requestSpecialization')}
        open={specModalOpen}
        onCancel={() => setSpecModalOpen(false)}
        onOk={handleRequestSpec}
        okButtonProps={{ disabled: !selectedSpec }}
      >
        <Select
          style={{ width: '100%' }}
          placeholder={t('common.selectSpecializations')}
          options={specOptions}
          value={selectedSpec}
          onChange={setSelectedSpec}
          optionFilterProp="label"
          showSearch
        />
      </Modal>
    </Row>
  );
}
MemberProfile.propTypes = {
  memberId: PropTypes.string,
};
