import { IdcardOutlined, LockFilled, LogoutOutlined } from '@ant-design/icons';
import { App, Button, Col, Form, Input, Modal, Row } from 'antd';
import type { MenuProps } from 'antd';
import { Accounts } from 'meteor/accounts-base';
import { Meteor } from 'meteor/meteor';
import React, { ReactNode, useCallback, useMemo, useState } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';
import ProfileModal from '../members/ProfileModal';

interface ChangePasswordValues {
  oldPassword: string;
  newPassword: string;
}

interface UserMenu {
  /** Menu items for the user actions, usable in any antd Menu/Dropdown. */
  actionItems: NonNullable<MenuProps['items']>;
  /** Dispatch a user-action menu key (`profile` | `changePassword` | `logout`). */
  handleAction: (key: string) => void;
  /** The ProfileModal node — render it once wherever the menu lives. */
  profileModal: ReactNode;
}

/**
 * Single source of truth for the current-user actions (profile, change
 * password, logout) plus the profile modal. Shared by the desktop Footer
 * dropdown and the mobile navigation menu so the behaviour stays identical.
 */
export default function useUserMenu(): UserMenu {
  const { modal, message } = App.useApp();
  const { t } = useTranslation();
  const [showProfile, setShowProfile] = useState(false);

  const toggleProfile = useCallback(() => setShowProfile(prev => !prev), []);

  const startChangePassword = useCallback(() => {
    function handleSubmit({ oldPassword, newPassword }: ChangePasswordValues) {
      Accounts.changePassword(oldPassword, newPassword, error => {
        if (error) {
          message.error({ content: error.message });
        } else {
          Modal.destroyAll();
        }
      });
    }

    modal.confirm({
      title: t('auth.changePassword'),
      footer: null,
      centered: true,
      closable: true,
      content: (
        <Form layout="vertical" onFinish={handleSubmit}>
          <Form.Item label={t('auth.currentPassword')} name="oldPassword" rules={[{ required: true, type: 'string' }]} required>
            <Input.Password placeholder={t('forms.placeholders.enterPassword')} autoComplete="off" />
          </Form.Item>
          <Form.Item label={t('auth.newPassword')} name="newPassword" rules={[{ required: true, type: 'string' }]} required>
            <Input.Password placeholder={t('forms.placeholders.enterPassword')} autoComplete="off" />
          </Form.Item>
          <Row gutter={[16, 16]} justify="end" align="middle">
            <Col>
              <Button type="primary" htmlType="submit">
                {t('common.submit')}
              </Button>
            </Col>
          </Row>
        </Form>
      ),
    });
  }, [modal, message, t]);

  const handleAction = useCallback(
    (key: string) => {
      if (key === 'profile') toggleProfile();
      else if (key === 'changePassword') startChangePassword();
      else if (key === 'logout') void Meteor.logout();
    },
    [toggleProfile, startChangePassword]
  );

  const actionItems = useMemo<NonNullable<MenuProps['items']>>(
    () => [
      { key: 'changePassword', label: t('auth.changePassword'), icon: <LockFilled /> },
      { key: 'profile', label: t('auth.profile'), icon: <IdcardOutlined /> },
      { key: 'logout', label: t('auth.logout'), icon: <LogoutOutlined />, danger: true },
    ],
    [t]
  );

  const profileModal = <ProfileModal showProfile={showProfile} toggleProfile={toggleProfile} />;

  return { actionItems, handleAction, profileModal };
}
