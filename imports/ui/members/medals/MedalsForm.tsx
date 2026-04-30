import { App, ColorPicker, Form, Input } from 'antd';
import { Meteor } from 'meteor/meteor';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';
import { getColorFromValues } from '/imports/helpers/colors/getColorFromValues';
import type { Medal } from '../../../api/types/misc';
import { DrawerContext, SubdrawerContext } from '../../app/App';
import type { DrawerContextValue } from '../../app/types';
import FormFooter from '../../components/FormFooter';

interface MedalsFormProps {
  setOpen: (open: boolean) => void;
  useSubdrawer?: boolean;
}

interface MedalFormValues {
  name: string;
  description?: string;
  color?: { toHexString?: () => string } | string;
}

export default function MedalsForm({ setOpen, useSubdrawer }: MedalsFormProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<MedalFormValues>();
  const { message, notification } = App.useApp();
  const [loading, setLoading] = useState(false);

  const drawer = useContext(useSubdrawer ? SubdrawerContext : DrawerContext) as DrawerContextValue;
  const model = useMemo(() => {
    return drawer.drawerModel as unknown as Medal & { _id?: string };
  }, [drawer]);

  useEffect(() => {
    if (Object.keys(model).length > 0) {
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
    (values: MedalFormValues) => {
      setLoading(true);
      const { name, description } = values;
      const args = [...(model?._id ? [model._id] : []), { name, color: getColorFromValues(values as unknown as Record<string, unknown>), description }];
      Meteor.callAsync(Meteor.user() && model?._id ? 'medals.update' : 'medals.insert', ...args)
        .then(() => {
          setOpen(false);
          form.resetFields();
          message.success(model?._id ? t('messages.medalUpdated') : t('messages.medalCreated'));
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
