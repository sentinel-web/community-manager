import { App, Form, Input, InputNumber, Rate, Select, Typography } from 'antd';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useCallback, useContext } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';
import { DrawerContext } from '../app/App';
import FormFooter from '../components/FormFooter';

const { Text } = Typography;

const QuestionnaireResponseForm = ({ setOpen, onSuccess }) => {
  const { drawerModel: questionnaire } = useContext(DrawerContext);
  const { message, notification } = App.useApp();
  const { t } = useTranslation();
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
        message.success(t('questionnaires.submitSuccess'));
        if (onSuccess) onSuccess();
      } catch (error) {
        notification.error({
          message: error.error,
          description: error.message,
        });
      }
    },
    [setOpen, questionnaire, message, notification, onSuccess, t]
  );

  const renderQuestionField = (question, index) => {
    const fieldName = `question_${index}`;
    const rules = question.required ? [{ required: true, message: t('questionnaires.questionRequired') }] : [];

    switch (question.type) {
      case 'text':
        return (
          <Form.Item key={index} label={question.text} name={fieldName} rules={rules}>
            <Input placeholder={t('questionnaires.enterAnswer')} />
          </Form.Item>
        );
      case 'textarea':
        return (
          <Form.Item key={index} label={question.text} name={fieldName} rules={rules}>
            <Input.TextArea placeholder={t('questionnaires.enterAnswer')} autoSize={{ minRows: 3 }} />
          </Form.Item>
        );
      case 'number':
        return (
          <Form.Item key={index} label={question.text} name={fieldName} rules={rules}>
            <InputNumber placeholder={t('questionnaires.enterNumber')} style={{ width: '100%' }} />
          </Form.Item>
        );
      case 'select':
        return (
          <Form.Item key={index} label={question.text} name={fieldName} rules={rules}>
            <Select
              placeholder={t('questionnaires.selectOption')}
              options={(question.options || []).map(opt => ({ value: opt, label: opt }))}
            />
          </Form.Item>
        );
      case 'multiselect':
        return (
          <Form.Item key={index} label={question.text} name={fieldName} rules={rules}>
            <Select
              mode="multiple"
              placeholder={t('questionnaires.selectOptions')}
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
            <Input placeholder={t('questionnaires.enterAnswer')} />
          </Form.Item>
        );
    }
  };

  if (!questionnaire || !questionnaire.questions?.length) {
    return <Text>{t('questionnaires.noQuestions')}</Text>;
  }

  return (
    <Form layout="vertical" form={form} onFinish={handleFinish}>
      {questionnaire.description && (
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          {questionnaire.description}
        </Text>
      )}
      {questionnaire.questions.map((question, index) => renderQuestionField(question, index))}
      <FormFooter setOpen={setOpen} submitText={t('questionnaires.submitResponse')} />
    </Form>
  );
};
QuestionnaireResponseForm.propTypes = {
  setOpen: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
};

export default QuestionnaireResponseForm;
