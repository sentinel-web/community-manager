import { Rate, Space, Tag, Typography } from 'antd';
import React from 'react';
import type { Answer, Question, Questionnaire } from '../../api/types/questionnaire';
import { useTranslation } from '../../i18n/LanguageContext';
import type { TranslateFn } from '../section/types';
import { useDrawerFrame } from '../drawer-stack';
import type { QuestionnaireResponseRow } from './types';

const { Text, Title } = Typography;

interface ResponseDetailModel {
  response: QuestionnaireResponseRow;
  questionnaire: Questionnaire;
}

interface AnswerDisplayProps {
  question: Question;
  answer: Answer | undefined;
  t: TranslateFn;
}

const ResponseDetailView = () => {
  const { model } = useDrawerFrame<void, ResponseDetailModel>();
  const { response, questionnaire } = (model || {}) as ResponseDetailModel;
  const { t } = useTranslation();

  if (!response || !questionnaire) {
    return <Text>{t('questionnaires.noResponseData')}</Text>;
  }

  const { respondentName, respondentId, submittedAt, answers } = response;

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div>
        <Text type="secondary">{t('questionnaires.respondent')}</Text>
        <div>{respondentId ? respondentName : <Tag color="blue">{t('questionnaires.anonymous')}</Tag>}</div>
      </div>
      <div>
        <Text type="secondary">{t('questionnaires.submitted')}</Text>
        <div>{submittedAt ? new Date(submittedAt).toLocaleString() : '-'}</div>
      </div>
      <div>
        <Title level={5}>{t('questionnaires.answers')}</Title>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {(questionnaire.questions || []).map((question, index) => {
            const answer = answers?.find(a => a.questionIndex === index);
            // Same stable-key rationale as QuestionnaireResponseForm: Question
            // type carries no _id, so we use type:text as a stable composite.
            return <AnswerDisplay key={`${question.type}:${question.text}`} question={question} answer={answer} t={t} />;
          })}
        </Space>
      </div>
    </Space>
  );
};

export default ResponseDetailView;

const AnswerDisplay = ({ question, answer, t }: AnswerDisplayProps) => {
  const value = answer?.value;
  const isEmpty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);

  const renderValue = () => {
    if (isEmpty) {
      return <Text type="secondary" italic>{t('questionnaires.noAnswer')}</Text>;
    }

    switch (question.type) {
      case 'rating':
        return <Rate disabled value={value as number} />;
      case 'multiselect':
        return (
          <Space wrap>
            {(value as string[]).map(v => (
              <Tag key={v}>{v}</Tag>
            ))}
          </Space>
        );
      case 'select':
        return <Tag>{value as string}</Tag>;
      case 'textarea':
        return <Text style={{ whiteSpace: 'pre-wrap' }}>{value as string}</Text>;
      default:
        return <Text>{String(value)}</Text>;
    }
  };

  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
      <Text strong>
        {question.text}
        {question.required && <Text type="danger"> *</Text>}
      </Text>
      <div style={{ marginTop: 4 }}>{renderValue()}</div>
    </div>
  );
};
