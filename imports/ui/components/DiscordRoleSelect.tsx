import { Form, Select } from 'antd';
import React from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';
import useDiscordGuild from '../hooks/useDiscordGuild';

// A cleared select yields `undefined`, which a `$set` would silently drop; `null` clears the mapping.
const clearToNull = (value: string | undefined): string | null => value ?? null;

/** Form field that maps an entity (rank, role, squad, specialization) to a Discord role. */
export default function DiscordRoleSelect() {
  const { t } = useTranslation();
  const guild = useDiscordGuild();
  return (
    <Form.Item name="discordRoleId" label={t('members.discordRole')} normalize={clearToNull}>
      <Select
        allowClear
        showSearch
        optionFilterProp="label"
        options={guild?.roles}
        disabled={!guild}
        placeholder={t('forms.placeholders.selectDiscordRole')}
      />
    </Form.Item>
  );
}
