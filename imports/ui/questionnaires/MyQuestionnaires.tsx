import { CheckCircleOutlined, ClockCircleOutlined, DeleteOutlined, FormOutlined } from '@ant-design/icons';
import { App, Button, Card, Col, Empty, Popconfirm, Row, Space, Spin, Tag, Tooltip, Typography } from 'antd';
import { Meteor } from 'meteor/meteor';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import type { QuestionnaireInterval } from '../../api/types/questionnaire';
import { useTranslation } from '../../i18n/LanguageContext';
import type { DrawerContextValue } from '../app/types';
import { DrawerContext } from '../app/App';
import type { TranslateFn } from '../section/types';
import SectionCard from '../section/SectionCard';
import QuestionnaireResponseForm from './QuestionnaireResponseForm';

const { Text, Paragraph } = Typography;

/** Shape returned by the `questionnaires.getActiveForUser` server method */
interface ActiveQuestionnaire {
  _id: string;
  name: string;
  description?: string;
  questionCount?: number;
  canRespond?: boolean;
  responseReason?: string;
  nextAllowedDate?: string | Date;
  responseCount?: number;
  allowAnonymous?: boolean;
  interval?: QuestionnaireInterval;
  latestResponseId?: string;
}

interface QuestionnaireCardProps {
  questionnaire: ActiveQuestionnaire;
  onFillOut: (questionnaire: ActiveQuestionnaire) => void;
  onRevoke: (responseId: string) => void;
  t: TranslateFn;
}

export default function MyQuestionnaires() {
  const [questionnaires, setQuestionnaires] = useState<ActiveQuestionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const { notification } = App.useApp();
  const drawer = useContext(DrawerContext) as DrawerContextValue;
  const { t } = useTranslation();

  const loadQuestionnaires = useCallback(async () => {
    try {
      setLoading(true);
      const result = await Meteor.callAsync('questionnaires.getActiveForUser');
      setQuestionnaires(result as ActiveQuestionnaire[]);
    } catch (error) {
      notification.error({
        message: (error as Meteor.Error).error,
        description: (error as Meteor.Error).message,
      });
    } finally {
      setLoading(false);
    }
  }, [notification]);

  useEffect(() => {
    loadQuestionnaires();
  }, [loadQuestionnaires]);

  const handleFillOut = useCallback(
    (questionnaire: ActiveQuestionnaire) => {
      drawer.setDrawerTitle(questionnaire.name);
      drawer.setDrawerModel(questionnaire as unknown as Record<string, unknown>);
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
    async (responseId: string) => {
      try {
        await Meteor.callAsync('questionnaireResponses.revoke', responseId);
        notification.success({ message: t('questionnaires.revokeSuccess') });
        loadQuestionnaires();
      } catch (error) {
        notification.error({
          message: (error as Meteor.Error).error,
          description: (error as Meteor.Error).message,
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

const QuestionnaireCard = ({ questionnaire, onFillOut, onRevoke, t }: QuestionnaireCardProps) => {
  const { name, description, questionCount, canRespond, responseReason, nextAllowedDate, responseCount, allowAnonymous, interval, latestResponseId } =
    questionnaire;

  const intervalLabels: Record<QuestionnaireInterval, string> = {
    once: t('questionnaires.intervalOnceLabel'),
    daily: t('questionnaires.intervalDaily'),
    weekly: t('questionnaires.intervalWeekly'),
    monthly: t('questionnaires.intervalMonthly'),
    unlimited: t('questionnaires.intervalUnlimited'),
  };

  const intervalLabel = interval ? intervalLabels[interval] || intervalLabels.once : intervalLabels.once;
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
        onConfirm={() => onRevoke(latestResponseId!)}
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
    const tags: React.ReactNode[] = [];
    if (allowAnonymous) tags.push(<Tag key="anon" color="blue">{t('questionnaires.anonymous')}</Tag>);
    if (interval && interval !== 'once') tags.push(<Tag key="interval" color="cyan">{intervalLabel}</Tag>);
    return tags.length > 0 ? <Space size={4}>{tags}</Space> : null;
  };

  const actions = [renderAction(), renderRevokeAction()].filter(Boolean) as React.ReactNode[];

  return (
    <Card title={name} extra={renderTags()} actions={actions}>
      <Space direction="vertical" style={{ width: '100%' }}>
        {description && (
          <Paragraph type="secondary" ellipsis={{ rows: 2 }}>
            {description}
          </Paragraph>
        )}
        <Text>{t('questionnaires.questionCount', { count: questionCount ?? 0 })}</Text>
        {responseCount !== undefined && responseCount > 0 && (
          <Text type="secondary">{t('questionnaires.responseCount', { count: responseCount })}</Text>
        )}
      </Space>
    </Card>
  );
};
