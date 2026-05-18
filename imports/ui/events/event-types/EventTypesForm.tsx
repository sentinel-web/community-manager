import { App, ColorPicker, Form, Input, Switch } from 'antd';
import { Meteor } from 'meteor/meteor';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';
import { DrawerContext, SubdrawerContext } from '../../app/App';
import type { DrawerContextValue } from '../../app/types';
import FormFooter from '../../components/FormFooter';
import { getColorFromValues } from '../../specializations/SpecializationForm';

interface EventTypesFormProps {
  setOpen: (open: boolean) => void;
  useSubdrawer?: boolean;
}

export default function EventTypesForm({ setOpen, useSubdrawer = false }: EventTypesFormProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const { message, notification } = App.useApp();
  const [loading, setLoading] = useState(false);

  const drawerCtx = useContext(useSubdrawer ? SubdrawerContext : DrawerContext) as DrawerContextValue;
  const model = useMemo(() => {
    return drawerCtx.drawerModel || {};
  }, [drawerCtx]);

  useEffect(() => {
    if (Object.keys(model).length > 0) {
      form.setFieldsValue(model);
    } else {
      form.setFieldsValue({
        name: '',
        description: '',
        color: null,
      });
    }
  }, [model, form.setFieldsValue]);

  const handleSubmit = useCallback(
    (values: Record<string, unknown>) => {
      setLoading(true);
      const { name, description, createDiscordEvent } = values as { name: string; description?: string; createDiscordEvent?: boolean };
      const args = [...(model?._id ? [model._id] : []), { name, color: getColorFromValues(values), description, createDiscordEvent }];
      Meteor.callAsync(Meteor.user() && model?._id ? 'eventTypes.update' : 'eventTypes.insert', ...args)
        .then(() => {
          setOpen(false);
          form.resetFields();
          message.success(model?._id ? t('messages.eventTypeUpdated') : t('messages.eventTypeCreated'));
        })
        .catch((error: Meteor.Error) => {
          notification.error({
            message: error.error,
            description: error.message,
          });
        })
        .finally(() => setLoading(false));
    },
    [setOpen, form, model, message, notification, t]
  );

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit} disabled={loading} initialValues={model}>
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
      <FormFooter setOpen={setOpen} />
    </Form>
  );
}
