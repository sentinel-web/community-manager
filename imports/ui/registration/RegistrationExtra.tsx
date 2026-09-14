import { CopyOutlined, KeyOutlined } from '@ant-design/icons';
import { App, Button, Form, Input, Modal, Space, Tooltip } from 'antd';
import { Meteor } from 'meteor/meteor';
import React, { useCallback, useEffect, useState } from 'react';
import type { Registration } from '../../api/types';
import type { Member } from '../../api/types/member';
import { generatePassword, usernameFromName } from '../../helpers/memberCredentials';
import useMethod from '../hooks/useMethod';
import { useTranslation } from '/imports/i18n/LanguageContext';

interface CredentialsFormValues {
  username: string;
  password: string;
}

interface ConfirmModalProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  record: Registration;
  onCreated: () => void;
}

const ConfirmModal = ({ open, setOpen, record, onCreated }: ConfirmModalProps) => {
  const { t } = useTranslation();
  const { message, notification } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm<CredentialsFormValues>();

  // Prefill the username from the applicant's desired name each time the
  // modal opens; the admin can still edit it.
  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({ username: usernameFromName(record?.name) });
  }, [open, record?.name, form]);

  const handleGeneratePassword = useCallback(() => {
    form.setFieldsValue({ password: generatePassword() });
    form.validateFields(['password']).catch(() => undefined);
  }, [form]);

  const handleCopyPassword = useCallback(async () => {
    const password = form.getFieldValue('password') as string | undefined;
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      message.success(t('registrations.passwordCopied'));
    } catch {
      // Clipboard access is unavailable outside secure contexts (plain http).
      message.error(t('registrations.copyFailed'));
    }
  }, [form, message, t]);

  const handleCreate = useCallback(async () => {
    setLoading(true);
    if (!record) {
      notification.error({
        message: t('common.error'),
        description: t('registrations.dataNotFound'),
      });
      setLoading(false);
      return;
    }

    try {
      const values = await form.validateFields();
      const { username, password } = values || {};
      const { name, id, age, discoveryType, steamProfileLink, discordTag, description } = record || {};
      const payload = {
        username,
        password,
        profile: { name, id, age, discoveryType, steamProfileLink, discordTag, description, registrationId: record._id },
      };
      await Meteor.callAsync('members.insert', payload);
      message.success(t('registrations.memberCreated'));
      onCreated();
      setOpen(false);
    } catch (error) {
      const err = error as Meteor.Error;
      notification.error({
        message: err.error as string,
        description: err.message,
      });
    } finally {
      setLoading(false);
    }
  }, [form, record, setOpen, onCreated, message, notification, t]);

  const toggleOpen = useCallback(() => setOpen(prevOpen => !prevOpen), [setOpen]);

  return (
    <Modal
      open={open}
      okButtonProps={{ loading }}
      onOk={handleCreate}
      onCancel={toggleOpen}
      okText={t('common.submit')}
      cancelText={t('common.cancel')}
      title={t('registrations.selectUsernamePassword')}
    >
      <Form form={form} layout="vertical">
        <Form.Item label={t('auth.username')} name="username" rules={[{ required: true, whitespace: true, type: 'string' }]} required>
          <Input placeholder={t('auth.enterUsername')} autoComplete="off" />
        </Form.Item>
        <Form.Item label={t('auth.password')} required>
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="password" rules={[{ required: true, type: 'string' }]} noStyle>
              <Input.Password placeholder={t('auth.enterPassword')} autoComplete="new-password" />
            </Form.Item>
            <Tooltip title={t('registrations.generatePassword')}>
              <Button icon={<KeyOutlined />} onClick={handleGeneratePassword} aria-label={t('registrations.generatePassword')} />
            </Tooltip>
            <Tooltip title={t('registrations.copyPassword')}>
              <Button icon={<CopyOutlined />} onClick={handleCopyPassword} aria-label={t('registrations.copyPassword')} />
            </Tooltip>
          </Space.Compact>
        </Form.Item>
      </Form>
    </Modal>
  );
};

interface RegistrationExtraProps {
  record: Registration;
}

export default function RegistrationExtra({ record }: RegistrationExtraProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const [createdAlready, setCreatedAlready] = useState(true);
  const { call: findMember } = useMethod<Member | undefined>('members.findOne');

  useEffect(() => {
    let cancelled = false;
    findMember({ 'profile.registrationId': record._id }, { fields: { services: 0 } }).then(res => {
      if (cancelled || !res.ok) return;
      setCreatedAlready(Boolean(res.data));
    });
    return () => {
      cancelled = true;
    };
  }, [record._id, findMember]);

  // The lookup above only runs on mount, so reflect a successful creation
  // immediately instead of leaving the button enabled until a reload.
  const handleCreated = useCallback(() => setCreatedAlready(true), []);

  return (
    <Space>
      <Button disabled={createdAlready} onClick={() => setOpen(true)}>
        {t('registrations.createMember')}
      </Button>
      <ConfirmModal open={open} setOpen={setOpen} record={record} onCreated={handleCreated} />
    </Space>
  );
}
