import { App, Button, Form, Input, Modal, Space } from 'antd';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useCallback, useEffect, useState } from 'react';

ConfirmModal.propTypes = {
  open: PropTypes.bool,
  setOpen: PropTypes.func,
  record: PropTypes.object,
};
const ConfirmModal = ({ open, setOpen, record }) => {
  const { message, notification } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const handleCreate = useCallback(async () => {
    setLoading(true);
    if (!record) {
      notification.error({
        message: 'Error',
        description: 'Data not found',
      });
      setLoading(false);
      return;
    }

    try {
      const values = await form.validateFields();
      const { username, password } = values || {};
      const { name, id, age, discoveryType, description } = record || {};
      const payload = {
        username,
        password,
        profile: { name, id, age, discoveryType, description, registrationId: record._id },
      };
      await Meteor.callAsync('members.insert', payload);
      message.success('Member created');
      setOpen(false);
    } catch (error) {
      console.error(error);
      notification.error({
        message: error.error,
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  }, [form, record, setOpen, message, notification]);

  const toggleOpen = useCallback(() => setOpen(prevOpen => !prevOpen), [setOpen]);

  return (
    <Modal
      open={open}
      okButttonProps={{ loading }}
      onOk={handleCreate}
      onCancel={toggleOpen}
      okText="Submit"
      cancelText="Cancel"
      title="Please select a username and a password"
    >
      <Form form={form} layout="vertical">
        <Form.Item label="Username" name="username" rules={[{ required: true, type: 'string' }]} required>
          <Input placeholder="Enter username" autoComplete="current-username" />
        </Form.Item>
        <Form.Item label="Password" name="password" rules={[{ required: true, type: 'string' }]} required>
          <Input.Password placeholder="Enter password" autoComplete="current-password" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

RegistrationExtra.propTypes = {
  record: PropTypes.object,
};
export default function RegistrationExtra({ record }) {
  const [open, setOpen] = useState(false);

  const [createdAlready, setCreatedAlready] = useState(true);

  useEffect(() => {
    Meteor.callAsync('members.findOne', { 'profile.registrationId': record._id }, { fields: { service: 0 } }).then(res => {
      if (res) setCreatedAlready(true);
      else setCreatedAlready(false);
    });
  }, [record]);

  return (
    <Space>
      <Button disabled={createdAlready} onClick={() => setOpen(true)}>
        Create member
      </Button>
      <ConfirmModal open={open} setOpen={setOpen} record={record} />
    </Space>
  );
}
