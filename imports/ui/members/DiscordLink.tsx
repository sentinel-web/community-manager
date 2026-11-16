import { App, Button, Space, Tag, Typography } from 'antd';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import React, { useCallback } from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';
import useMethod from '../hooks/useMethod';

interface DiscordLinkProps {
  /** Link state of the shown member; ignored on the caller's own profile, which is tracked live. */
  linked?: boolean;
  own?: boolean;
}

/** Shows whether a member is linked to a Discord account and lets members link / unlink their own. */
export default function DiscordLink({ linked = false, own = false }: DiscordLinkProps) {
  const { t } = useTranslation();
  const { modal } = App.useApp();
  const ownLinked = useTracker(() => !!Meteor.user()?.profile?.discordId, []);
  const { call: createCode, loading } = useMethod<string>('discord.createLinkCode');
  const { call: unlink } = useMethod('discord.unlink', { success: t('members.discordLink.removed') });

  const handleLink = useCallback(async () => {
    const result = await createCode();
    if (!result.ok) return;
    modal.info({
      title: t('members.discordLink.create'),
      content: (
        <>
          <Typography.Paragraph>{t('members.discordLink.instructions')}</Typography.Paragraph>
          <Typography.Paragraph copyable code>{`/link code:${result.data}`}</Typography.Paragraph>
        </>
      ),
    });
  }, [createCode, modal, t]);
  const handleUnlink = useCallback(() => void unlink(), [unlink]);

  if (own ? ownLinked : linked) {
    return (
      <Space>
        <Tag color="green">{t('members.discordLink.linked')}</Tag>
        {own && (
          <Button size="small" onClick={handleUnlink}>
            {t('members.discordLink.remove')}
          </Button>
        )}
      </Space>
    );
  }
  return own ? (
    <Button size="small" loading={loading} onClick={handleLink}>
      {t('members.discordLink.create')}
    </Button>
  ) : null;
}
