import { App, ColorPicker, Form, Input, Select } from 'antd';
import { Meteor } from 'meteor/meteor';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';
import { getColorFromValues } from '/imports/helpers/colors/getColorFromValues';
import type { Rank } from '../../../api/types/rank';
import { useDrawerFrame } from '../../drawer-stack';
import FormFooter from '../../components/FormFooter';
import RanksSelect from './RanksSelect';

interface RankFormValues {
  name: string;
  type: 'player' | 'zeus';
  description?: string;
  color?: { toHexString?: () => string } | string;
  previousRankId?: string;
  nextRankId?: string;
}

export default function RanksForm() {
  const { t } = useTranslation();
  const [form] = Form.useForm<RankFormValues>();
  const { message, notification } = App.useApp();
  const [loading, setLoading] = useState(false);
  const { model, resolve, cancel } = useDrawerFrame<string, Partial<Rank> & { _id?: string }>();

  useEffect(() => {
    if (model && Object.keys(model).length > 0) {
      form.setFieldsValue(model as unknown as RankFormValues);
    } else {
      form.setFieldsValue({
        name: '',
        description: '',
        color: undefined,
        previousRankId: undefined,
        nextRankId: undefined,
      });
    }
  }, [model, form.setFieldsValue]);

  const handleSubmit = useCallback(
    async (values: RankFormValues) => {
      setLoading(true);
      const { name, description, previousRankId, nextRankId, type } = values;
      const args = [
        ...(model?._id ? [model._id] : []),
        { name, color: getColorFromValues(values as unknown as Record<string, unknown>), description, previousRankId, nextRankId, type },
      ];
      try {
        const result = (await Meteor.callAsync(
          Meteor.user() && model?._id ? 'ranks.update' : 'ranks.insert',
          ...args
        )) as string | undefined;
        message.success(model?._id ? t('messages.rankUpdated') : t('messages.rankCreated'));
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
      <Form.Item name="type" label={t('members.type')} rules={[{ required: true, type: 'string' }]} required>
        <Select
          placeholder={t('common.selectType')}
          options={[
            { label: t('members.playerRank'), value: 'player' },
            { label: t('members.zeusRank'), value: 'zeus' },
          ]}
        />
      </Form.Item>
      <Form.Item name="description" label={t('common.description')} rules={[{ required: false, type: 'string' }]}>
        <Input.TextArea autoSize placeholder={t('forms.placeholders.enterDescription')} />
      </Form.Item>
      <Form.Item name="color" label={t('common.color')}>
        <ColorPicker format="hex" />
      </Form.Item>
      <RanksSelect
        name="previousRankId"
        label={t('members.previousRank')}
        rules={[{ required: false, type: 'string' }]}
        defaultValue={model?.previousRankId as string | undefined}
      />
      <RanksSelect
        name="nextRankId"
        label={t('members.nextRank')}
        rules={[{ required: false, type: 'string' }]}
        defaultValue={model?.nextRankId as string | undefined}
      />
      <FormFooter onCancel={cancel} />
    </Form>
  );
}
