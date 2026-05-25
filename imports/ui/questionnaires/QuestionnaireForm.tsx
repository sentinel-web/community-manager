import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, Select, Space, Switch } from 'antd';
import React, { useCallback, useMemo } from 'react';
import type { Questionnaire, QuestionnaireInterval, QuestionnaireStatus, QuestionType } from '../../api/types/questionnaire';
import { useTranslation } from '../../i18n/LanguageContext';
import type { TranslateFn } from '../section/types';
import { useDrawerFrame } from '../drawer-stack';
import useMethod from '../hooks/useMethod';
import FormFooter from '../components/FormFooter';

interface QuestionTypeOption {
  value: QuestionType;
  label: string;
}

interface IntervalOption {
  value: QuestionnaireInterval;
  label: string;
}

interface QuestionnaireFormValues {
  name: string;
  description?: string;
  status: QuestionnaireStatus;
  allowAnonymous?: boolean;
  interval: QuestionnaireInterval;
  questions: Array<{
    text: string;
    type: QuestionType;
    required?: boolean;
    options?: string[];
  }>;
}

interface QuestionItemProps {
  name: number;
  restField: { fieldKey?: number };
  remove: (index: number) => void;
  t: TranslateFn;
  questionTypes: QuestionTypeOption[];
}

const QuestionnaireForm = () => {
  const { model, resolve, cancel } = useDrawerFrame<string, Partial<Questionnaire>>();
  const { t } = useTranslation();
  const questionnaire = (model || {}) as unknown as Questionnaire;
  const { isUpdate, endpoint } = useMemo(
    () => (questionnaire?._id ? { isUpdate: true, endpoint: 'questionnaires.update' } : { isUpdate: false, endpoint: 'questionnaires.insert' }),
    [questionnaire?._id]
  );

  const { call, loading } = useMethod<string | undefined>(endpoint, {
    success: isUpdate ? t('questionnaires.updated') : t('questionnaires.created'),
  });

  const questionTypes: QuestionTypeOption[] = useMemo(
    () => [
      { value: 'text', label: t('questionnaires.typeText') },
      { value: 'textarea', label: t('questionnaires.typeLongText') },
      { value: 'number', label: t('questionnaires.typeNumber') },
      { value: 'select', label: t('questionnaires.typeSingleChoice') },
      { value: 'multiselect', label: t('questionnaires.typeMultipleChoice') },
      { value: 'rating', label: t('questionnaires.typeRating') },
    ],
    [t]
  );

  const intervalOptions: IntervalOption[] = useMemo(
    () => [
      { value: 'once', label: t('questionnaires.intervalOnce') },
      { value: 'daily', label: t('questionnaires.intervalDaily') },
      { value: 'weekly', label: t('questionnaires.intervalWeekly') },
      { value: 'monthly', label: t('questionnaires.intervalMonthly') },
      { value: 'unlimited', label: t('questionnaires.intervalUnlimited') },
    ],
    [t]
  );

  const handleFinish = useCallback(
    async (values: QuestionnaireFormValues) => {
      const payload = {
        ...values,
        createdAt: questionnaire?.createdAt || new Date(),
        updatedAt: new Date(),
      };
      const args = isUpdate ? [questionnaire._id, payload] : [payload];
      const res = await call(...args);
      if (!res.ok) return;
      resolve(questionnaire?._id ?? res.data);
    },
    [resolve, questionnaire?._id, questionnaire?.createdAt, isUpdate, call]
  );

  const [form] = Form.useForm<QuestionnaireFormValues>();

  return (
    <Form layout="vertical" form={form} onFinish={handleFinish} initialValues={questionnaire} disabled={loading}>
      <Form.Item
        label={t('common.name')}
        name="name"
        rules={[{ required: true, type: 'string', message: t('questionnaires.pleaseEnterName') }]}
        required
      >
        <Input placeholder={t('questionnaires.enterQuestionnaireName')} />
      </Form.Item>
      <Form.Item label={t('common.description')} name="description" rules={[{ required: false, type: 'string' }]}>
        <Input.TextArea autoSize placeholder={t('forms.placeholders.enterDescription')} />
      </Form.Item>
      <Form.Item label={t('common.status')} name="status" rules={[{ required: false, type: 'string' }]} initialValue="draft">
        <Select
          placeholder={t('questionnaires.selectStatus')}
          options={[
            { value: 'draft', label: t('questionnaires.draft') },
            { value: 'active', label: t('questionnaires.active') },
            { value: 'closed', label: t('questionnaires.closed') },
          ]}
        />
      </Form.Item>
      <Form.Item
        label={t('questionnaires.allowAnonymous')}
        name="allowAnonymous"
        valuePropName="checked"
        tooltip={t('questionnaires.allowAnonymousTooltip')}
      >
        <Switch />
      </Form.Item>
      <Form.Item
        label={t('questionnaires.responseInterval')}
        name="interval"
        initialValue="once"
        tooltip={t('questionnaires.responseIntervalTooltip')}
      >
        <Select placeholder={t('questionnaires.selectInterval')} options={intervalOptions} />
      </Form.Item>

      <Card title={t('questionnaires.questions')} size="small" style={{ marginBottom: 16 }}>
        <Form.List name="questions">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...restField }) => (
                <QuestionItem key={key} name={name} restField={restField} remove={remove} t={t} questionTypes={questionTypes} />
              ))}
              <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                {t('questionnaires.addQuestion')}
              </Button>
            </>
          )}
        </Form.List>
      </Card>

      <FormFooter onCancel={cancel} loading={loading} />
    </Form>
  );
};

const QuestionItem = ({ name, restField, remove, t, questionTypes }: QuestionItemProps) => {
  const form = Form.useFormInstance<QuestionnaireFormValues>();
  const questionType = Form.useWatch(['questions', name, 'type'], form);

  return (
    <Card size="small" style={{ marginBottom: 12 }}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
          <Form.Item
            {...restField}
            name={[name, 'text']}
            rules={[{ required: true, message: t('questionnaires.pleaseEnterQuestion') }]}
            style={{ marginBottom: 8, flex: 1 }}
          >
            <Input placeholder={t('questionnaires.questionText')} />
          </Form.Item>
          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
        </Space>
        <Space wrap>
          <Form.Item
            {...restField}
            name={[name, 'type']}
            rules={[{ required: true, message: t('questionnaires.selectAType') }]}
            style={{ marginBottom: 8 }}
          >
            <Select placeholder={t('questionnaires.questionType')} options={questionTypes} style={{ width: 150 }} />
          </Form.Item>
          <Form.Item {...restField} name={[name, 'required']} style={{ marginBottom: 8 }}>
            <Select
              placeholder={t('questionnaires.requiredQuestion')}
              options={[
                { value: true, label: t('questionnaires.required') },
                { value: false, label: t('questionnaires.optional') },
              ]}
              style={{ width: 110 }}
              defaultValue={false}
            />
          </Form.Item>
        </Space>
        {(questionType === 'select' || questionType === 'multiselect') && (
          <Form.Item
            {...restField}
            name={[name, 'options']}
            rules={[{ required: true, message: t('questionnaires.pleaseAddOptions') }]}
            style={{ marginBottom: 8 }}
          >
            <Select mode="tags" placeholder={t('questionnaires.addOptions')} tokenSeparators={[',']} />
          </Form.Item>
        )}
      </Space>
    </Card>
  );
};

export default QuestionnaireForm;
