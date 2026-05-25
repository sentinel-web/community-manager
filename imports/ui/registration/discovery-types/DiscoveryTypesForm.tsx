import { ColorPicker, Form, Input, Switch } from 'antd';
import { Meteor } from 'meteor/meteor';
import React, { useCallback, useEffect } from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';
import { useDrawerFrame } from '../../drawer-stack';
import useMethod from '../../hooks/useMethod';
import FormFooter from '../../components/FormFooter';
import { getColorFromValues } from '/imports/helpers/colors/getColorFromValues';
import type { DiscoveryType } from '../../../api/types';

export default function DiscoveryTypeForm() {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const { model, resolve, cancel } = useDrawerFrame<string, Partial<DiscoveryType> & { _id?: string }>();

  const { call, loading } = useMethod<string | undefined>(Meteor.user() && model?._id ? 'discoveryTypes.update' : 'discoveryTypes.insert', {
    success: model?._id ? t('messages.discoveryTypeUpdated') : t('messages.discoveryTypeCreated'),
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

  const handleSubmit = useCallback(
    async (values: Record<string, unknown>) => {
      const { name, description, hasTextInput } = values as { name: string; description?: string; hasTextInput?: boolean };
      const args = [...(model?._id ? [model._id] : []), { name, color: getColorFromValues(values), description, hasTextInput: !!hasTextInput }];
      const res = await call(...args);
      if (!res.ok) return;
      resolve(model?._id ?? res.data);
    },
    [model, resolve, call]
  );

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit} disabled={loading}>
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
