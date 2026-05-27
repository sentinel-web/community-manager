import { ColorPicker, Form, Input } from 'antd';
import React, { useMemo } from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';
import { getColorFromValues } from '/imports/helpers/colors/getColorFromValues';
import useEntityForm from '../hooks/useEntityForm';
import FormFooter from '../components/FormFooter';
import RichTextEditor from '../components/RichTextEditor';
import type { BriefingTemplate } from '../../api/types';

export default function BriefingTemplatesForm() {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const {
    onFinish,
    loading,
    model: rawModel,
    cancel,
  } = useEntityForm<Record<string, unknown>, Partial<BriefingTemplate>>({
    collection: 'briefingTemplates',
    created: 'messages.briefingTemplateCreated',
    updated: 'messages.briefingTemplateUpdated',
    toPayload: values => {
      const { name, description, content } = values as { name: string; description?: string; content?: string };
      return { name, color: getColorFromValues(values), description, content };
    },
  });

  // Provide values synchronously via initialValues (not a setFieldsValue effect):
  // the RichTextEditor initializes its document from `value` on first render, so
  // a deferred effect would race the editor's own lifecycle and lose the content.
  const model = useMemo(
    () => ({
      name: rawModel?.name ?? '',
      content: rawModel?.content ?? '',
      description: rawModel?.description ?? '',
      color: rawModel?.color ?? null,
    }),
    [rawModel]
  );

  return (
    <Form form={form} layout="vertical" initialValues={model} onFinish={onFinish} disabled={loading}>
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
      <FormFooter onCancel={cancel} loading={loading} />
    </Form>
  );
}
