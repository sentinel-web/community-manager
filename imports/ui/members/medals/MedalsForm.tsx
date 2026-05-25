import { ColorPicker, Form, Input } from 'antd';
import { Meteor } from 'meteor/meteor';
import React, { useCallback, useEffect } from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';
import { getColorFromValues } from '/imports/helpers/colors/getColorFromValues';
import type { Medal } from '../../../api/types/misc';
import { useDrawerFrame } from '../../drawer-stack';
import useMethod from '../../hooks/useMethod';
import FormFooter from '../../components/FormFooter';

interface MedalFormValues {
  name: string;
  description?: string;
  color?: { toHexString?: () => string } | string;
}

export default function MedalsForm() {
  const { t } = useTranslation();
  const [form] = Form.useForm<MedalFormValues>();
  const { model, resolve, cancel } = useDrawerFrame<string, Partial<Medal> & { _id?: string }>();

  const { call, loading } = useMethod<string | undefined>(Meteor.user() && model?._id ? 'medals.update' : 'medals.insert', {
    success: model?._id ? t('messages.medalUpdated') : t('messages.medalCreated'),
  });

  useEffect(() => {
    if (model && Object.keys(model).length > 0) {
      form.setFieldsValue(model as unknown as MedalFormValues);
    } else {
      form.setFieldsValue({
        name: '',
        description: '',
        color: undefined,
      });
    }
  }, [model, form.setFieldsValue]);

  const handleSubmit = useCallback(
    async (values: MedalFormValues) => {
      const { name, description } = values;
      const args = [
        ...(model?._id ? [model._id] : []),
        { name, color: getColorFromValues(values as unknown as Record<string, unknown>), description },
      ];
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
      <FormFooter onCancel={cancel} loading={loading} />
    </Form>
  );
}
