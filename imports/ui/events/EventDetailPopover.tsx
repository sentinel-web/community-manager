import { Button, Col, Descriptions, Modal, Row, Space, Spin, Tag } from 'antd';
import dayjs from 'dayjs';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';

export default function EventDetailPopover({ event, open, setOpen, onEdit }) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const currentUserId = useTracker(() => Meteor.userId(), []);

  useEffect(() => {
    if (!event?._id || !open) return;
    setLoading(true);
    Meteor.callAsync('events.detail', event._id)
      .then(setDetail)
      .finally(() => setLoading(false));
  }, [event?._id, open]);

  const handleRsvp = useCallback(() => {
    if (!event?._id) return;
    setRsvpLoading(true);
    Meteor.callAsync('events.rsvp', event._id)
      .then(isNowSignedUp => {
        setDetail(prev => prev ? { ...prev, isSignedUp: isNowSignedUp } : prev);
      })
      .finally(() => setRsvpLoading(false));
  }, [event?._id]);

  const handleEdit = useCallback(() => {
    setOpen(false);
    onEdit?.(event);
  }, [event, onEdit, setOpen]);

  const handleClose = useCallback(() => setOpen(false), [setOpen]);

  const isSignedUp = detail?.isSignedUp ?? (event?.attendees || []).includes(currentUserId);

  return (
    <Modal
      title={t('events.eventDetails')}
      open={open}
      onCancel={handleClose}
      footer={
        <Space>
          <Button onClick={handleClose}>{t('common.cancel')}</Button>
          {onEdit && (
            <Button onClick={handleEdit}>{t('common.edit')}</Button>
          )}
          <Button type="primary" loading={rsvpLoading} onClick={handleRsvp} danger={isSignedUp}>
            {isSignedUp ? t('events.signOff') : t('events.signUp')}
          </Button>
        </Space>
      }
      destroyOnClose
    >
      {loading ? (
        <Row justify="center" style={{ padding: 24 }}>
          <Spin />
        </Row>
      ) : detail ? (
        <Row gutter={[0, 16]}>
          <Col span={24}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label={t('events.eventName')}>{detail.name}</Descriptions.Item>
              {detail.eventTypeName && (
                <Descriptions.Item label={t('events.eventType')}>
                  <Tag color={detail.eventTypeColor}>{detail.eventTypeName}</Tag>
                </Descriptions.Item>
              )}
              <Descriptions.Item label={t('events.startDate')}>
                {detail.start ? dayjs(detail.start).format('YYYY-MM-DD HH:mm') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('events.endDate')}>
                {detail.end ? dayjs(detail.end).format('YYYY-MM-DD HH:mm') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('events.hosts')}>
                {detail.resolvedHosts?.map(h => h.name).join(', ') || '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('events.attendeeCount')}>
                {detail.resolvedAttendees?.length || 0}
              </Descriptions.Item>
              {detail.description && (
                <Descriptions.Item label={t('common.description')}>{detail.description}</Descriptions.Item>
              )}
            </Descriptions>
          </Col>
          {isSignedUp && (
            <Col span={24}>
              <Tag color="green">{t('events.youAreSignedUp')}</Tag>
            </Col>
          )}
        </Row>
      ) : null}
    </Modal>
  );
}
EventDetailPopover.propTypes = {
  event: PropTypes.object,
  open: PropTypes.bool,
  setOpen: PropTypes.func,
  onEdit: PropTypes.func,
};
