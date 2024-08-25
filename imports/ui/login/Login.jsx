import React from "react";
import { Meteor } from "meteor/meteor";
import { Button, Col, Form, Input, Row, Typography } from "antd";

const handleSubmit = (values) => {
  const { username, password } = values;
  Meteor.loginWithPassword({ username }, password, (error) => {
    if (error) {
      alert(error.message);
    }
  });
};

const handleRegister = (event) => {
  event.preventDefault();
  const username = prompt("Enter username");
  if (!username) {
    return;
  }
  const password = prompt("Enter password");
  if (!password) {
    return;
  }
  Meteor.callAsync("members.register", username, password)
    .then(() => {
      alert("Registered successfully");
    })
    .catch((error) => {
      alert(
        JSON.stringify(
          { error: error?.error, message: error?.message },
          null,
          2
        )
      );
    });
};

export default function Login() {
  return (
    <Row gutter={[0, 16]} className="login">
      <Col span={24}>
        <Typography.Title level={2}>Login</Typography.Title>
      </Col>
      <Col span={24}>
        <Form layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="Username"
            name="username"
            rules={[{ required: true, type: "string" }]}
            required
          >
            <Input placeholder="Enter username" />
          </Form.Item>
          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, type: "string" }]}
            required
          >
            <Input.Password placeholder="Enter password" />
          </Form.Item>
          <Row gutter={[16, 16]} align="middle">
            <Col span={12}>
              <Button onClick={handleRegister}>Register</Button>
            </Col>
            <Col span={12}>
              <Button type="primary" htmlType="submit">
                Login
              </Button>
            </Col>
          </Row>
        </Form>
      </Col>
    </Row>
  );
}
