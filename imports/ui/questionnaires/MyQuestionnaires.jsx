import { CheckCircleOutlined, ClockCircleOutlined, DeleteOutlined, FormOutlined } from '@ant-design/icons';
import { App, Button, Card, Col, Empty, Popconfirm, Row, Space, Spin, Tag, Tooltip, Typography } from 'antd';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';
import { DrawerContext } from '../app/App';
import SectionCard from '../section/SectionCard';
import QuestionnaireResponseForm from './QuestionnaireResponseForm';

const { Text, Paragraph } = Typography;

export default function MyQuestionnaires() {
  const [questionnaires, setQuestionnaires] = useState([]);
  const [loading, setLoading] = useState(true);
  const { notification } = App.useApp();
  const drawer = useContext(DrawerContext);
  const { t } = useTranslation();

  const loadQuestionnaires = useCallback(async () => {
    try {
      setLoading(true);
      const result = await Meteor.callAsync('questionnaires.getActiveForUser');
      setQuestionnaires(result);
    } catch (error) {
      notification.error({
        message: error.error,
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  }, [notification]);

  useEffect(() => {
    loadQuestionnaires();
  }, [loadQuestionnaires]);

  const handleFillOut = useCallback(
    questionnaire => {
      drawer.setDrawerTitle(questionnaire.name);
      drawer.setDrawerModel(questionnaire);
      drawer.setDrawerComponent(
        React.createElement(QuestionnaireResponseForm, {
          setOpen: drawer.setDrawerOpen,
          onSuccess: loadQuestionnaires,
        })
      );
      drawer.setDrawerOpen(true);
    },
    [drawer, loadQuestionnaires]
  );

  const handleRevoke = useCallback(
    async responseId => {
      try {
        await Meteor.callAsync('questionnaireResponses.revoke', responseId);
        notification.success({ message: t('questionnaires.revokeSuccess') });
        loadQuestionnaires();
      } catch (error) {
        notification.error({
          message: error.error,
          description: error.message,
        });
      }
    },
    [notification, loadQuestionnaires, t]
  );

  return (
    <SectionCard title={t('questionnaires.myTitle')} ready={!loading}>
      {loading ? (
        <Row justify="center" style={{ padding: 48 }}>
          <Spin size="large" />
        </Row>
      ) : questionnaires.length === 0 ? (
        <Empty description={t('questionnaires.noActiveQuestionnaires')} />
      ) : (
        <Row gutter={[16, 16]}>
          {questionnaires.map(questionnaire => (
            <Col xs={24} sm={12} lg={8} key={questionnaire._id}>
              <QuestionnaireCard questionnaire={questionnaire} onFillOut={handleFillOut} onRevoke={handleRevoke} t={t} />
            </Col>
          ))}
        </Row>
      )}
    </SectionCard>
  );
}

const QuestionnaireCard = ({ questionnaire, onFillOut, onRevoke, t }) => {
  const { name, description, questionCount, canRespond, responseReason, nextAllowedDate, responseCount, allowAnonymous, interval, latestResponseId } =
    questionnaire;

  const intervalLabels = {
    once: t('questionnaires.intervalOnceLabel'),
    daily: t('questionnaires.intervalDaily'),
    weekly: t('questionnaires.intervalWeekly'),
    monthly: t('questionnaires.intervalMonthly'),
    unlimited: t('questionnaires.intervalUnlimited'),
  };

  const intervalLabel = intervalLabels[interval] || intervalLabels.once;
  const canRevoke = !allowAnonymous && latestResponseId && !canRespond;

  const renderAction = () => {
    if (canRespond) {
      return (
        <Button key="fill" type="primary" icon={<FormOutlined />} onClick={() => onFillOut(questionnaire)}>
          {t('questionnaires.fillOut')}
        </Button>
      );
    }

    if (interval === 'once') {
      return (
        <Space key="completed">
          <CheckCircleOutlined style={{ color: '#52c41a' }} />
          <Text type="success">{t('questionnaires.completed')}</Text>
        </Space>
      );
    }

    return (
      <Tooltip title={responseReason}>
        <Space key="waiting">
          <ClockCircleOutlined style={{ color: '#faad14' }} />
          <Text type="warning">
            {nextAllowedDate ? t('questionnaires.availableDate', { date: new Date(nextAllowedDate).toLocaleDateString() }) : t('questionnaires.pleaseWait')}
          </Text>
        </Space>
      </Tooltip>
    );
  };

  const renderRevokeAction = () => {
    if (!canRevoke) return null;
    return (
      <Popconfirm
        key="revoke"
        title={t('questionnaires.revokeResponse')}
        description={t('questionnaires.revokeConfirm')}
        onConfirm={() => onRevoke(latestResponseId)}
        okText={t('common.yes')}
        cancelText={t('common.no')}
      >
        <Button danger icon={<DeleteOutlined />}>
          {t('questionnaires.revoke')}
        </Button>
      </Popconfirm>
    );
  };

  const renderTags = () => {
    const tags = [];
    if (allowAnonymous) tags.push(<Tag key="anon" color="blue">{t('questionnaires.anonymous')}</Tag>);
    if (interval && interval !== 'once') tags.push(<Tag key="interval" color="cyan">{intervalLabel}</Tag>);
    return tags.length > 0 ? <Space size={4}>{tags}</Space> : null;
  };

  const actions = [renderAction(), renderRevokeAction()].filter(Boolean);

  return (
    <Card title={name} extra={renderTags()} actions={actions}>
      <Space direction="vertical" style={{ width: '100%' }}>
        {description && (
          <Paragraph type="secondary" ellipsis={{ rows: 2 }}>
            {description}
          </Paragraph>
        )}
        <Text>{t('questionnaires.questionCount', { count: questionCount })}</Text>
        {responseCount > 0 && (
          <Text type="secondary">{t('questionnaires.responseCount', { count: responseCount })}</Text>
        )}
      </Space>
    </Card>
  );
};
QuestionnaireCard.propTypes = {
  questionnaire: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    questionCount: PropTypes.number,
    canRespond: PropTypes.bool,
    responseReason: PropTypes.string,
    nextAllowedDate: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    responseCount: PropTypes.number,
    allowAnonymous: PropTypes.bool,
    interval: PropTypes.string,
    latestResponseId: PropTypes.string,
  }).isRequired,
  onFillOut: PropTypes.func.isRequired,
  onRevoke: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
};
