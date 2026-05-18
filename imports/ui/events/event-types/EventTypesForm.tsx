import { ColorPicker, Form, Input, Switch } from 'antd';
import React, { useEffect } from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';
import useEntityForm from '../../hooks/useEntityForm';
import FormFooter from '../../components/FormFooter';
import { getColorFromValues } from '../../specializations/SpecializationForm';
import type { EventType } from '../../../api/types';

export default function EventTypesForm() {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const { onFinish, loading, model, cancel } = useEntityForm<Record<string, unknown>, Partial<EventType>>({
    collection: 'eventTypes',
    created: 'messages.eventTypeCreated',
    updated: 'messages.eventTypeUpdated',
    toPayload: values => {
      const { name, description, createDiscordEvent } = values as { name: string; description?: string; createDiscordEvent?: boolean };
      return { name, color: getColorFromValues(values), description, createDiscordEvent };
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
      <Form.Item name="createDiscordEvent" label="Discord Event-Benachrichtigung erstellen?" valuePropName="checked">
        <Switch checkedChildren="Ja" unCheckedChildren="Nein" />
      </Form.Item>
      <FormFooter onCancel={cancel} loading={loading} />
    </Form>
  );
}
