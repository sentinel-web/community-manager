import { ColorPicker, Form, Input, Select } from 'antd';
import React, { useEffect } from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';
import { getColorFromValues } from '/imports/helpers/colors/getColorFromValues';
import type { Rank } from '../../../api/types/rank';
import useEntityForm from '../../hooks/useEntityForm';
import FormFooter from '../../components/FormFooter';
import RanksSelect from './RanksSelect';

interface RankFormValues {
  name: string;
  type: 'player' | 'zeus';
  description?: string;
  color?: { toHexString?: () => string } | string;
  previousRankId?: string;
  nextRankId?: string;
  discordRoleId?: string;
}

export default function RanksForm() {
  const { t } = useTranslation();
  const [form] = Form.useForm<RankFormValues>();
  const { onFinish, loading, model, cancel } = useEntityForm<RankFormValues, Partial<Rank> & { _id?: string }>({
    collection: 'ranks',
    created: 'messages.rankCreated',
    updated: 'messages.rankUpdated',
    toPayload: values => {
      const { name, description, previousRankId, nextRankId, type, discordRoleId } = values;
      return { name, color: getColorFromValues(values), description, previousRankId, nextRankId, type, discordRoleId };
    },
  });

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

  return (
    <Form form={form} layout="vertical" onFinish={onFinish} disabled={loading}>
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
      <Form.Item
        name="discordRoleId"
        label={t('members.discordRoleId')}
        rules={[{ required: false, type: 'string', pattern: /^\d+$/, message: 'Muss eine gültige ID sein!' }]}
      >
        <Input placeholder={t('forms.placeholders.enterDiscordRoleId')} allowClear />
      </Form.Item>
      <FormFooter onCancel={cancel} loading={loading} />
    </Form>
  );
}
