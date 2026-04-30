import { App, Form, Input, InputNumber, Rate, Select, Typography } from 'antd';
import { Meteor } from 'meteor/meteor';
import React, { useCallback, useContext } from 'react';
import type { Question, Questionnaire } from '../../api/types/questionnaire';
import { useTranslation } from '../../i18n/LanguageContext';
import type { DrawerContextValue } from '../app/types';
import { DrawerContext } from '../app/App';
import FormFooter from '../components/FormFooter';

const { Text } = Typography;

interface QuestionnaireResponseFormProps {
  setOpen: (open: boolean) => void;
  onSuccess?: () => void;
}

type ResponseFormValues = Record<string, string | number | string[] | undefined>;

const QuestionnaireResponseForm = ({ setOpen, onSuccess }: QuestionnaireResponseFormProps) => {
  const { drawerModel } = useContext(DrawerContext) as DrawerContextValue;
  const questionnaire = drawerModel as unknown as Questionnaire;
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
        setOpen(false);
        message.success(t('questionnaires.submitSuccess'));
        if (onSuccess) onSuccess();
      } catch (error) {
        notification.error({
          message: (error as Meteor.Error).error,
          description: (error as Meteor.Error).message,
        });
      }
    },
    [setOpen, questionnaire, message, notification, onSuccess, t]
  );

  const renderQuestionField = (question: Question, index: number) => {
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

export default QuestionnaireResponseForm;
