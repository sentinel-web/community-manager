import { ColorPicker, Form, Input } from 'antd';
import React, { useEffect } from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';
import useEntityForm from '../../hooks/useEntityForm';
import FormFooter from '../../components/FormFooter';
import { getColorFromValues } from '/imports/helpers/colors/getColorFromValues';
import type { TaskStatus } from '/imports/api/types/misc';

export default function TaskStatusForm() {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const { onFinish, loading, model, cancel } = useEntityForm<Record<string, unknown>, Partial<TaskStatus>>({
    collection: 'taskStatus',
    created: 'messages.taskStatusCreated',
    updated: 'messages.taskStatusUpdated',
    toPayload: values => {
      const { name, description } = values as { name: string; description?: string };
      return { name, color: getColorFromValues(values), description };
    },
  });

  useEffect(() => {
    if (model && Object.keys(model).length > 0) {
      form.setFieldsValue(model);
    } else {
      form.setFieldsValue({
        name: '',
        description: '',
        color: null,
      });
    }
  }, [model, form.setFieldsValue]);

  return (
    <Form form={form} layout="vertical" onFinish={onFinish} disabled={loading}>
      <Form.Item name="name" label={t('common.name')} rules={[{ required: true, type: 'string' }]} required>
        <Input placeholder={t('forms.placeholders.enterName')} />
      </Form.Item>
      <Form.Item name="description" label={t('common.description')} rules={[{ required: false, type: 'string' }]}>
        <Input.TextArea autoSize placeholder={t('forms.placeholders.enterDescription')} />
      </Form.Item>
      <Form.Item name="color" label={t('common.color')}>
        <ColorPicker format="hex" />
      </Form.Item>
      <FormFooter onCancel={cancel} loading={loading} />
    </Form>
  );
}
