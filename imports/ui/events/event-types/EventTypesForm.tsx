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
      const { name, description, countsForInactivity } = values as { name: string; description?: string; countsForInactivity?: boolean };
      return { name, color: getColorFromValues(values), description, countsForInactivity: countsForInactivity !== false };
    },
  });

  useEffect(() => {
    if (model && Object.keys(model).length > 0) {
      // Unset means true (#366), so legacy event types show the switch on.
      form.setFieldsValue({ ...model, countsForInactivity: model.countsForInactivity !== false });
    } else {
      form.setFieldsValue({
        name: '',
        description: '',
        color: null,
        countsForInactivity: true,
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
        <ColorPicker format="hex" disabledAlpha />
      </Form.Item>
      <Form.Item
        name="countsForInactivity"
        label={t('events.countsForInactivity')}
        tooltip={t('events.countsForInactivityHint')}
        valuePropName="checked"
        rules={[{ type: 'boolean' }]}
      >
        <Switch />
      </Form.Item>
      <FormFooter onCancel={cancel} loading={loading} />
    </Form>
  );
}
