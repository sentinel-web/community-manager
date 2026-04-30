import { App, Button, Form, Input, Modal, Space } from 'antd';
import { Meteor } from 'meteor/meteor';
import React, { useCallback, useEffect, useState } from 'react';
import type { Registration } from '../../api/types';
import type { Member } from '../../api/types/member';
import { useTranslation } from '/imports/i18n/LanguageContext';

interface ConfirmModalProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  record: Registration;
}

const ConfirmModal = ({ open, setOpen, record }: ConfirmModalProps) => {
  const { t } = useTranslation();
  const { message, notification } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

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
  }, [form, record, setOpen, message, notification, t]);

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
        <Form.Item label={t('auth.username')} name="username" rules={[{ required: true, type: 'string' }]} required>
          <Input placeholder={t('auth.enterUsername')} autoComplete="current-username" />
        </Form.Item>
        <Form.Item label={t('auth.password')} name="password" rules={[{ required: true, type: 'string' }]} required>
          <Input.Password placeholder={t('auth.enterPassword')} autoComplete="current-password" />
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

  useEffect(() => {
    Meteor.callAsync('members.findOne', { 'profile.registrationId': record._id }, { fields: { service: 0 } }).then((res: Member | undefined) => {
      if (res) setCreatedAlready(true);
      else setCreatedAlready(false);
    });
  }, [record]);

  return (
    <Space>
      <Button disabled={createdAlready} onClick={() => setOpen(true)}>
        {t('registrations.createMember')}
      </Button>
      <ConfirmModal open={open} setOpen={setOpen} record={record} />
    </Space>
  );
}
