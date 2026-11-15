import { Alert, App, Button, Col, Form, Input, Popconfirm, Row, Select, Space, Switch, Typography } from 'antd';
import { useFind } from 'meteor/react-meteor-data';
import React, { useCallback, useMemo } from 'react';
import SettingsCollection from '/imports/api/collections/settings.collection';
import {
  DISCORD_CONFIG_DEFAULTS,
  DISCORD_CONFIG_KEYS,
  DISCORD_SNOWFLAKE,
  DISCORD_STATUS_KEY,
  type DiscordConfig,
  type DiscordStatus,
} from '/imports/api/discord/settings';
import { locales } from '/imports/i18n';
import { useTranslation } from '/imports/i18n/LanguageContext';
import useDiscordGuild from '../hooks/useDiscordGuild';
import useMethod from '../hooks/useMethod';

type DiscordFormValues = DiscordConfig & { token?: string };

const STATUS_ALERT = { connected: 'success', connecting: 'info', disabled: 'info', error: 'error' } as const;
const STATUS_LABEL = {
  connecting: 'settings.discord.statusConnecting',
  disabled: 'settings.discord.statusDisabled',
  error: 'settings.discord.statusError',
} as const;
const LANGUAGE_OPTIONS = Object.entries(locales).map(([value, { name }]) => ({ value, label: name }));
const SWITCHES = [
  ['discord-recruitment-threads', 'settings.discord.recruitmentThreads'],
  ['discord-inbound-role-sync', 'settings.discord.inboundRoleSync'],
  ['discord-task-notifications', 'settings.discord.taskNotifications'],
  ['discord-spam-protection-enabled', 'settings.discord.spamProtectionEnabled'],
] as const;

/**
 * Discord integration settings. Saved as a whole through `discord.configure` (one bot restart per
 * save). The bot token is write-only: it is never sent to the client, so the field starts empty.
 * Rendered only once the parent's `settings` subscription is ready.
 */
export default function DiscordSettings() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const docs = useFind(() => SettingsCollection.find({ key: { $in: [...DISCORD_CONFIG_KEYS, DISCORD_STATUS_KEY] } }), []);
  const { initialValues, status } = useMemo(() => {
    const stored = Object.fromEntries(docs.map(doc => [doc.key, doc.value]));
    return {
      initialValues: { ...DISCORD_CONFIG_DEFAULTS, ...stored } as DiscordFormValues,
      status: (stored[DISCORD_STATUS_KEY] ?? { state: 'disabled', tokenSet: false }) as DiscordStatus,
    };
  }, [docs]);
  const connected = status.state === 'connected';
  const guild = useDiscordGuild(status.state);

  const { call: configure, loading } = useMethod('discord.configure', { success: t('settings.discord.saved') });
  const { call: syncMembers, loading: syncing } = useMethod<number>('discord.syncMembers');
  const { call: linkByTag, loading: linking } = useMethod<number>('discord.linkByTag');

  const handleFinish = useCallback(
    ({ token, ...config }: DiscordFormValues) => {
      // A cleared select yields `undefined`, which the wire format drops; send the empty default instead.
      const known = Object.fromEntries(DISCORD_CONFIG_KEYS.map(key => [key, config[key] ?? DISCORD_CONFIG_DEFAULTS[key]]));
      void configure(known, token);
    },
    [configure]
  );
  const handleSync = useCallback(async () => {
    const result = await syncMembers();
    if (result.ok) message.success(t('settings.discord.membersSynced', { count: result.data }));
  }, [syncMembers, message, t]);
  const handleLinkByTag = useCallback(async () => {
    const result = await linkByTag();
    if (result.ok) message.success(t('settings.discord.linkedByTag', { count: result.data }));
  }, [linkByTag, message, t]);

  return (
    <Form<DiscordFormValues> layout="vertical" initialValues={initialValues} onFinish={handleFinish} disabled={loading}>
      <Typography.Title level={4}>{t('settings.discordIntegration')}</Typography.Title>
      <Alert
        showIcon
        style={{ marginBottom: 16 }}
        type={status.error ? (connected ? 'warning' : 'error') : STATUS_ALERT[status.state]}
        message={
          status.state === 'connected'
            ? t('settings.discord.statusConnected', { bot: status.botTag ?? '', guild: status.guildName ?? '' })
            : t(STATUS_LABEL[status.state])
        }
        description={status.error}
      />
      <Form.Item name="discord-enabled" label={t('settings.discord.enabled')} valuePropName="checked">
        <Switch />
      </Form.Item>
      <Row gutter={[16, 0]}>
        <Col xs={24} lg={12}>
          <Form.Item name="token" label={t('settings.discord.botToken')}>
            <Input.Password autoComplete="new-password" placeholder={status.tokenSet ? t('settings.discord.botTokenKeep') : undefined} />
          </Form.Item>
        </Col>
        <Col xs={24} lg={12}>
          <Form.Item name="discord-server-id" label={t('settings.discord.serverId')} rules={[{ pattern: DISCORD_SNOWFLAKE }]}>
            <Input allowClear />
          </Form.Item>
        </Col>
        <Col xs={24} lg={12}>
          <Form.Item name="discord-events-channel-id" label={t('settings.discord.eventsChannel')}>
            <Select allowClear showSearch optionFilterProp="label" options={guild?.channels} disabled={!guild} />
          </Form.Item>
        </Col>
        <Col xs={24} lg={12}>
          <Form.Item name="discord-recruitment-channel-id" label={t('settings.discord.recruitmentChannel')}>
            <Select allowClear showSearch optionFilterProp="label" options={guild?.channels} disabled={!guild} />
          </Form.Item>
        </Col>
        <Col xs={24} lg={12}>
          <Form.Item name="discord-language" label={t('settings.discord.language')}>
            <Select options={LANGUAGE_OPTIONS} />
          </Form.Item>
        </Col>
      </Row>
      {SWITCHES.map(([name, label]) => (
        <Form.Item key={name} name={name} label={t(label)} valuePropName="checked">
          <Switch />
        </Form.Item>
      ))}
      <Space wrap>
        <Button type="primary" htmlType="submit" loading={loading}>
          {t('common.save')}
        </Button>
        <Button onClick={handleSync} loading={syncing} disabled={!connected}>
          {t('settings.discord.syncMembers')}
        </Button>
        <Popconfirm title={t('settings.discord.linkByTagConfirm')} onConfirm={handleLinkByTag} disabled={!connected}>
          <Button loading={linking} disabled={!connected}>
            {t('settings.discord.linkByTag')}
          </Button>
        </Popconfirm>
      </Space>
    </Form>
  );
}
