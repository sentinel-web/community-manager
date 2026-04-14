import { Rate, Space, Tag, Typography } from 'antd';
import PropTypes from 'prop-types';
import React, { useContext } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';
import { SubdrawerContext } from '../app/App';

const { Text, Title } = Typography;

const ResponseDetailView = () => {
  const { drawerModel } = useContext(SubdrawerContext);
  const { response, questionnaire } = drawerModel || {};
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
            return <AnswerDisplay key={index} question={question} answer={answer} t={t} />;
          })}
        </Space>
      </div>
    </Space>
  );
};

export default ResponseDetailView;

const AnswerDisplay = ({ question, answer, t }) => {
  const value = answer?.value;
  const isEmpty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);

  const renderValue = () => {
    if (isEmpty) {
      return <Text type="secondary" italic>{t('questionnaires.noAnswer')}</Text>;
    }

    switch (question.type) {
      case 'rating':
        return <Rate disabled value={value} />;
      case 'multiselect':
        return (
          <Space wrap>
            {value.map((v, i) => (
              <Tag key={i}>{v}</Tag>
            ))}
          </Space>
        );
      case 'select':
        return <Tag>{value}</Tag>;
      case 'textarea':
        return <Text style={{ whiteSpace: 'pre-wrap' }}>{value}</Text>;
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
AnswerDisplay.propTypes = {
  question: PropTypes.shape({
    text: PropTypes.string,
    type: PropTypes.string,
    required: PropTypes.bool,
  }),
  answer: PropTypes.shape({
    questionIndex: PropTypes.number,
    value: PropTypes.any,
  }),
  t: PropTypes.func,
};
