import { App, Button, Form, Input, Modal, Space } from 'antd';
import React from 'react';
import { Meteor } from 'meteor/meteor';

const ConfirmModal = ({ open, setOpen, record, handleExtraCleanup }) => {
  const { message, notification } = App.useApp();
  const [loading, setLoading] = React.useState(false);
  const [form] = Form.useForm();

  async function handleCreate() {
    setLoading(true);
    if (!record) {
      notification.error({
        message: 'Error',
        description: 'Data not found',
      });
      setLoading(false);
      return;
    }

    const validation = await form
      .validateFields()
      .then(values => {
        const { username, password } = values;
        const payload = {
          username,
          password,
          ...record,
        };
        Meteor.callAsync('members.insert', payload)
          .then(() => {
            message.success('Member created');
            setOpen(false);
            handleExtraCleanup && handleExtraCleanup();
          })
          .catch(error => {
            console.error(error);
            notification.error({
              message: error.error,
              description: error.message,
            });
          })
          .finally(() => setLoading(false));
      })
      .catch(error => {
        notification.error({
          message: 'Error',
          description: 'Username and password are required',
        });
      });

    if (!validation) {
      setLoading(false);
      return;
    }
  }

  const toggleOpen = () => setOpen(!open);

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
  const [open, setOpen] = React.useState(false);

  return (
    <Space>
      <Button onClick={() => setOpen(true)}>Create member</Button>
      <ConfirmModal open={open} setOpen={setOpen} record={record} handleExtraCleanup={handleExtraCleanup} />
    </Space>
  );
}
