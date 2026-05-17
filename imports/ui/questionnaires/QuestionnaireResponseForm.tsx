import { App, Form, Input, InputNumber, Rate, Select, Typography } from 'antd';
import { Meteor } from 'meteor/meteor';
import React, { useCallback } from 'react';
import type { Question, Questionnaire } from '../../api/types/questionnaire';
import { useTranslation } from '../../i18n/LanguageContext';
import { useDrawerFrame } from '../drawer-stack';
import FormFooter from '../components/FormFooter';

const { Text } = Typography;

type ResponseFormValues = Record<string, string | number | string[] | undefined>;

const QuestionnaireResponseForm = () => {
  const { model, resolve, cancel } = useDrawerFrame<true, Questionnaire>();
  const questionnaire = (model || {}) as unknown as Questionnaire;
  const { message, notification } = App.useApp();
  const { t } = useTranslation();
  const [form] = Form.useForm<ResponseFormValues>();

  const handleFinish = useCallback(
    async (values: ResponseFormValues) => {
      try {
        const answers = (questionnaire.questions || []).map((question, index) => ({
          questionIndex: index,
          value: values[`question_${index}`],
        }));

        await Meteor.callAsync('questionnaireResponses.submit', questionnaire._id, answers);
        message.success(t('questionnaires.submitSuccess'));
        // Resolve with a truthy sentinel so the opener can detect "submitted"
        // and refresh its list — undefined would mean "cancelled".
        resolve(true);
      } catch (error) {
        notification.error({
          message: (error as Meteor.Error).error,
          description: (error as Meteor.Error).message,
        });
      }
    },
    [resolve, questionnaire, message, notification, t]
  );

  const renderQuestionField = (question: Question, index: number) => {
    const fieldName = `question_${index}`;
    const rules = question.required ? [{ required: true, message: t('questionnaires.questionRequired') }] : [];
    const key = `${question.type}:${question.text}`;

    switch (question.type) {
      case 'text':
        return (
          <Form.Item key={key} label={question.text} name={fieldName} rules={rules}>
            <Input placeholder={t('questionnaires.enterAnswer')} />
          </Form.Item>
        );
      case 'textarea':
        return (
          <Form.Item key={key} label={question.text} name={fieldName} rules={rules}>
            <Input.TextArea placeholder={t('questionnaires.enterAnswer')} autoSize={{ minRows: 3 }} />
          </Form.Item>
        );
      case 'number':
        return (
          <Form.Item key={key} label={question.text} name={fieldName} rules={rules}>
            <InputNumber placeholder={t('questionnaires.enterNumber')} style={{ width: '100%' }} />
          </Form.Item>
        );
      case 'select':
        return (
          <Form.Item key={key} label={question.text} name={fieldName} rules={rules}>
            <Select
              placeholder={t('questionnaires.selectOption')}
              options={(question.options || []).map(opt => ({ value: opt, label: opt }))}
            />
          </Form.Item>
        );
      case 'multiselect':
        return (
          <Form.Item key={key} label={question.text} name={fieldName} rules={rules}>
            <Select
              mode="multiple"
              placeholder={t('questionnaires.selectOptions')}
              options={(question.options || []).map(opt => ({ value: opt, label: opt }))}
            />
          </Form.Item>
        );
      case 'rating':
        return (
          <Form.Item key={key} label={question.text} name={fieldName} rules={rules}>
            <Rate />
          </Form.Item>
        );
      default:
        return (
          <Form.Item key={key} label={question.text} name={fieldName} rules={rules}>
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
      <FormFooter onCancel={cancel} submitText={t('questionnaires.submitResponse')} />
    </Form>
  );
};

export default QuestionnaireResponseForm;
