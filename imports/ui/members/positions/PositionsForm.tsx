import { App, ColorPicker, Form, Input, InputNumber } from 'antd';
import { Meteor } from 'meteor/meteor';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';
import { getColorFromValues } from '/imports/helpers/colors/getColorFromValues';
import { useDrawerFrame } from '../../drawer-stack';
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
  const { message, notification } = App.useApp();
  const [loading, setLoading] = useState(false);
  const { model, resolve, cancel } = useDrawerFrame<string, Partial<Position> & { _id?: string }>();

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

  const handleSubmit = useCallback(
    async (values: PositionFormValues) => {
      setLoading(true);
      const { name, description, order } = values;
      const args = [
        ...(model?._id ? [model._id] : []),
        { name, color: getColorFromValues(values as unknown as Record<string, unknown>), description, order },
      ];
      try {
        const result = (await Meteor.callAsync(
          Meteor.user() && model?._id ? 'positions.update' : 'positions.insert',
          ...args
        )) as string | undefined;
        message.success(model?._id ? t('messages.positionUpdated') : t('messages.positionCreated'));
        resolve(model?._id ?? result);
      } catch (error) {
        const err = error as Meteor.Error;
        notification.error({
          message: err.error as string,
          description: err.message,
        });
      } finally {
        setLoading(false);
      }
    },
    [model, resolve, message, notification, t]
  );

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit} disabled={loading}>
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
      <FormFooter onCancel={cancel} />
    </Form>
  );
}
