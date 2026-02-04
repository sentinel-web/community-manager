import { Rate, Space, Tag, Typography } from 'antd';
import PropTypes from 'prop-types';
import React, { useContext } from 'react';
import { SubdrawerContext } from '../app/App';

const { Text, Title } = Typography;

const ResponseDetailView = () => {
  const { drawerModel } = useContext(SubdrawerContext);
  const { response, questionnaire } = drawerModel || {};

  if (!response || !questionnaire) {
    return <Text>No response data available.</Text>;
  }

  const { respondentName, respondentId, submittedAt, answers } = response;

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div>
        <Text type="secondary">Respondent</Text>
        <div>{respondentId ? respondentName : <Tag color="blue">Anonymous</Tag>}</div>
      </div>
      <div>
        <Text type="secondary">Submitted</Text>
        <div>{submittedAt ? new Date(submittedAt).toLocaleString() : '-'}</div>
      </div>
      <div>
        <Title level={5}>Answers</Title>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {(questionnaire.questions || []).map((question, index) => {
            const answer = answers?.find(a => a.questionIndex === index);
            return <AnswerDisplay key={index} question={question} answer={answer} />;
          })}
        </Space>
      </div>
    </Space>
  );
};

export default ResponseDetailView;

const AnswerDisplay = ({ question, answer }) => {
  const value = answer?.value;
  const isEmpty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);

  const renderValue = () => {
    if (isEmpty) {
      return <Text type="secondary" italic>No answer</Text>;
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
};
