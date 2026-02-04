import { App, Form, Input, InputNumber, Rate, Select, Typography } from 'antd';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useCallback, useContext } from 'react';
import { DrawerContext } from '../app/App';
import FormFooter from '../components/FormFooter';

const { Text } = Typography;

const QuestionnaireResponseForm = ({ setOpen, onSuccess }) => {
  const { drawerModel: questionnaire } = useContext(DrawerContext);
  const { message, notification } = App.useApp();
  const [form] = Form.useForm();

  const handleFinish = useCallback(
    async values => {
      try {
        const answers = (questionnaire.questions || []).map((question, index) => ({
          questionIndex: index,
          value: values[`question_${index}`],
        }));

        await Meteor.callAsync('questionnaireResponses.submit', questionnaire._id, answers);
        setOpen(false);
        message.success('Response submitted successfully');
        if (onSuccess) onSuccess();
      } catch (error) {
        notification.error({
          message: error.error,
          description: error.message,
        });
      }
    },
    [setOpen, questionnaire, message, notification, onSuccess]
  );

  const renderQuestionField = (question, index) => {
    const fieldName = `question_${index}`;
    const rules = question.required ? [{ required: true, message: 'This question is required' }] : [];

    switch (question.type) {
      case 'text':
        return (
          <Form.Item key={index} label={question.text} name={fieldName} rules={rules}>
            <Input placeholder="Enter your answer" />
          </Form.Item>
        );
      case 'textarea':
        return (
          <Form.Item key={index} label={question.text} name={fieldName} rules={rules}>
            <Input.TextArea placeholder="Enter your answer" autoSize={{ minRows: 3 }} />
          </Form.Item>
        );
      case 'number':
        return (
          <Form.Item key={index} label={question.text} name={fieldName} rules={rules}>
            <InputNumber placeholder="Enter a number" style={{ width: '100%' }} />
          </Form.Item>
        );
      case 'select':
        return (
          <Form.Item key={index} label={question.text} name={fieldName} rules={rules}>
            <Select
              placeholder="Select an option"
              options={(question.options || []).map(opt => ({ value: opt, label: opt }))}
            />
          </Form.Item>
        );
      case 'multiselect':
        return (
          <Form.Item key={index} label={question.text} name={fieldName} rules={rules}>
            <Select
              mode="multiple"
              placeholder="Select options"
              options={(question.options || []).map(opt => ({ value: opt, label: opt }))}
            />
          </Form.Item>
        );
      case 'rating':
        return (
          <Form.Item key={index} label={question.text} name={fieldName} rules={rules}>
            <Rate />
          </Form.Item>
        );
      default:
        return (
          <Form.Item key={index} label={question.text} name={fieldName} rules={rules}>
            <Input placeholder="Enter your answer" />
          </Form.Item>
        );
    }
  };

  if (!questionnaire || !questionnaire.questions?.length) {
    return <Text>This questionnaire has no questions.</Text>;
  }

  return (
    <Form layout="vertical" form={form} onFinish={handleFinish}>
      {questionnaire.description && (
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          {questionnaire.description}
        </Text>
      )}
      {questionnaire.questions.map((question, index) => renderQuestionField(question, index))}
      <FormFooter setOpen={setOpen} submitText="Submit Response" />
    </Form>
  );
};
QuestionnaireResponseForm.propTypes = {
  setOpen: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
};

export default QuestionnaireResponseForm;
