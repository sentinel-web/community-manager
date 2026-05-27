import { ColorPicker, Form, Input, Switch } from 'antd';
import React, { useEffect } from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';
import useEntityForm from '../../hooks/useEntityForm';
import FormFooter from '../../components/FormFooter';
import { getColorFromValues } from '/imports/helpers/colors/getColorFromValues';
import type { DiscoveryType } from '../../../api/types';

export default function DiscoveryTypeForm() {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const { onFinish, loading, model, cancel } = useEntityForm<Record<string, unknown>, Partial<DiscoveryType> & { _id?: string }>({
    collection: 'discoveryTypes',
    created: 'messages.discoveryTypeCreated',
    updated: 'messages.discoveryTypeUpdated',
    toPayload: values => {
      const { name, description, hasTextInput } = values as { name: string; description?: string; hasTextInput?: boolean };
      return { name, color: getColorFromValues(values), description, hasTextInput: !!hasTextInput };
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
        hasTextInput: false,
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
      <Form.Item name="hasTextInput" label={t('registrations.hasTextInput')} valuePropName="checked" rules={[{ type: 'boolean' }]}>
        <Switch />
      </Form.Item>
      <FormFooter onCancel={cancel} loading={loading} />
    </Form>
  );
}
