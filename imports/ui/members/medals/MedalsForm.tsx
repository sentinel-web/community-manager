import { ColorPicker, Form, Input } from 'antd';
import React, { useEffect } from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';
import { getColorFromValues } from '/imports/helpers/colors/getColorFromValues';
import type { Medal } from '../../../api/types/misc';
import useEntityForm from '../../hooks/useEntityForm';
import FormFooter from '../../components/FormFooter';

interface MedalFormValues {
  name: string;
  description?: string;
  color?: { toHexString?: () => string } | string;
}

export default function MedalsForm() {
  const { t } = useTranslation();
  const [form] = Form.useForm<MedalFormValues>();
  const { onFinish, loading, model, cancel } = useEntityForm<MedalFormValues, Partial<Medal> & { _id?: string }>({
    collection: 'medals',
    created: 'messages.medalCreated',
    updated: 'messages.medalUpdated',
    toPayload: values => ({ name: values.name, color: getColorFromValues(values), description: values.description }),
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
