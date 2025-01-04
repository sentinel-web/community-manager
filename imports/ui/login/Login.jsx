import React, { useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { Button, Col, Form, Input, Row, Typography } from 'antd';
import RegistrationModal from '../registration/RegistrationModal';

const handleSubmit = values => {
  const { username, password } = values;
  Meteor.loginWithPassword({ username }, password, error => {
    if (error) {
      alert(error.message);
    }
  });
};

export default function Login() {
  const [open, setOpen] = useState(false);
  return (
    <Row gutter={[0, 16]} className="login">
      <Col span={24}>
        <Typography.Title level={2}>Login</Typography.Title>
      </Col>
      <Col span={24}>
        <Form layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="Username" name="username" rules={[{ required: true, type: 'string' }]} required>
            <Input placeholder="Enter username" autoComplete="current-username" />
          </Form.Item>
          <Form.Item label="Password" name="password" rules={[{ required: true, type: 'string' }]} required>
            <Input.Password placeholder="Enter password" autoComplete="current-password" />
          </Form.Item>
          <Row gutter={[16, 16]} align="middle">
            <Col span={12}>
              <Button onClick={() => setOpen(true)}>Register</Button>
            </Col>
            <Col span={12}>
              <Button type="primary" htmlType="submit">
                Login
              </Button>
            </Col>
          </Row>
        </Form>
      </Col>
      <RegistrationModal open={open} setOpen={setOpen} />
    </Row>
  );
}
