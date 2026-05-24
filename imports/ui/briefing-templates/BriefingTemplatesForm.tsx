import { App, ColorPicker, Form, Input } from 'antd';
import { Meteor } from 'meteor/meteor';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';
import { getColorFromValues } from '/imports/helpers/colors/getColorFromValues';
import { useDrawerFrame } from '../drawer-stack';
import FormFooter from '../components/FormFooter';
import RichTextEditor from '../components/RichTextEditor';
import type { BriefingTemplate } from '../../api/types';

export default function BriefingTemplatesForm() {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const { message, notification } = App.useApp();
  const [loading, setLoading] = useState(false);
  const { model, resolve, cancel } = useDrawerFrame<string, Partial<BriefingTemplate>>();

  useEffect(() => {
    if (model && Object.keys(model).length > 0) {
      form.setFieldsValue(model);
    } else {
      form.setFieldsValue({ name: '', content: '', description: '', color: null });
    }
  }, [model, form.setFieldsValue]);

  const handleSubmit = useCallback(
    async (values: Record<string, unknown>) => {
      setLoading(true);
      const { name, description, content } = values as { name: string; description?: string; content?: string };
      const args = [...(model?._id ? [model._id] : []), { name, color: getColorFromValues(values), description, content }];
      try {
        const result = (await Meteor.callAsync(model?._id ? 'briefingTemplates.update' : 'briefingTemplates.insert', ...args)) as string | undefined;
        message.success(model?._id ? t('messages.briefingTemplateUpdated') : t('messages.briefingTemplateCreated'));
        resolve(model?._id ?? result);
      } catch (error) {
        const err = error as Meteor.Error;
        notification.error({ message: err.error as string, description: err.message });
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
      <Form.Item name="content" label={t('briefingTemplates.content')}>
        <RichTextEditor placeholder={t('forms.placeholders.enterDescription')} />
      </Form.Item>
      <Form.Item name="description" label={t('briefingTemplates.note')} rules={[{ required: false, type: 'string' }]}>
        <Input.TextArea autoSize placeholder={t('forms.placeholders.enterDescription')} />
      </Form.Item>
      <Form.Item name="color" label={t('common.color')}>
        <ColorPicker format="hex" />
      </Form.Item>
      <FormFooter onCancel={cancel} />
    </Form>
  );
}
