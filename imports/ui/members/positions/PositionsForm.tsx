import { ColorPicker, Form, Input, InputNumber } from 'antd';
import React, { useEffect } from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';
import { getColorFromValues } from '/imports/helpers/colors/getColorFromValues';
import useEntityForm from '../../hooks/useEntityForm';
import FormFooter from '../../components/FormFooter';
import type { Position } from '../../../api/types/misc';

interface PositionFormValues {
  name: string;
  description?: string;
  color?: { toHexString?: () => string } | string;
  order?: number;
}

export default function PositionsForm() {
  const { t } = useTranslation();
  const [form] = Form.useForm<PositionFormValues>();
  const { onFinish, loading, model, cancel } = useEntityForm<PositionFormValues, Partial<Position> & { _id?: string }>({
    collection: 'positions',
    created: 'messages.positionCreated',
    updated: 'messages.positionUpdated',
    toPayload: values => ({ name: values.name, color: getColorFromValues(values), description: values.description, order: values.order }),
  });

  useEffect(() => {
    if (model && Object.keys(model).length > 0) {
      form.setFieldsValue(model as unknown as PositionFormValues);
    } else {
      form.setFieldsValue({
        name: '',
        description: '',
        color: undefined,
        order: undefined,
      });
    }
  }, [model, form.setFieldsValue]);

  return (
    <Form form={form} layout="vertical" onFinish={onFinish} disabled={loading}>
      <Form.Item name="name" label={t('common.name')} rules={[{ required: true, type: 'string' }]} required>
        <Input placeholder={t('forms.placeholders.enterName')} />
      </Form.Item>
      <Form.Item name="order" label={t('positions.order')} rules={[{ type: 'number' }]}>
        <InputNumber min={0} placeholder={t('positions.order')} />
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
