import { App, ColorPicker, Form, Input, InputNumber } from 'antd';
import { Meteor } from 'meteor/meteor';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';
import { getColorFromValues } from '/imports/helpers/colors/getColorFromValues';
import { DrawerContext, SubdrawerContext } from '../../app/App';
import type { DrawerContextValue } from '../../app/types';
import FormFooter from '../../components/FormFooter';
import type { PositionDoc } from './positions.columns';

interface PositionsFormProps {
  setOpen: (open: boolean) => void;
  useSubdrawer?: boolean;
}

interface PositionFormValues {
  name: string;
  description?: string;
  color?: { toHexString?: () => string } | string;
  order?: number;
}

export default function PositionsForm({ setOpen, useSubdrawer }: PositionsFormProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<PositionFormValues>();
  const { message, notification } = App.useApp();
  const [loading, setLoading] = useState(false);

  const drawer = useContext(useSubdrawer ? SubdrawerContext : DrawerContext) as DrawerContextValue;
  const model = useMemo(() => {
    return drawer.drawerModel as unknown as PositionDoc & { _id?: string };
  }, [drawer]);

  useEffect(() => {
    if (Object.keys(model).length > 0) {
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
    (values: PositionFormValues) => {
      setLoading(true);
      const { name, description, order } = values;
      const args = [...(model?._id ? [model._id] : []), { name, color: getColorFromValues(values as unknown as Record<string, unknown>), description, order }];
      Meteor.callAsync(Meteor.user() && model?._id ? 'positions.update' : 'positions.insert', ...args)
        .then(() => {
          setOpen(false);
          form.resetFields();
          message.success(model?._id ? t('messages.positionUpdated') : t('messages.positionCreated'));
        })
        .catch(error => {
          notification.error({
            message: (error as Meteor.Error).error as string,
            description: (error as Meteor.Error).message,
          });
        })
        .finally(() => setLoading(false));
    },
    [setOpen, form, model, message, notification, t]
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
      <FormFooter setOpen={setOpen} />
    </Form>
  );
}
