import { App, Button, Form, Input, Modal, Space } from 'antd';
import React, { useCallback, useState } from 'react';
import { Meteor } from 'meteor/meteor';

const ConfirmModal = ({ open, setOpen, record, handleExtraCleanup }) => {
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
      const { username, password } = values;
      const payload = {
        username,
        password,
        ...record,
      };
      await Meteor.callAsync('members.insert', payload);
      message.success('Member created');
      setOpen(false);
      handleExtraCleanup?.();
    } catch (error) {
      console.error(error);
      notification.error({
        message: error.error,
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  }, [form, record, handleExtraCleanup, setOpen, message, notification]);

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

export default function RegistrationExtra({ record, handleExtraCleanup }) {
  const [open, setOpen] = useState(false);

  return (
    <Space>
      <Button onClick={() => setOpen(true)}>Create member</Button>
      <ConfirmModal open={open} setOpen={setOpen} record={record} handleExtraCleanup={handleExtraCleanup} />
    </Space>
  );
}
