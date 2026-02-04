import { App, Button, Card, Col, Form, Input, Row, Typography } from 'antd';
import { Meteor } from 'meteor/meteor';
import React, { useCallback, useState } from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';
import RegistrationModal from '../registration/RegistrationModal';

export default function Login() {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const [open, setOpen] = useState(false);

  const handleSubmit = useCallback(
    values => {
      const { username, password } = values;
      Meteor.loginWithPassword({ username }, password, error => {
        if (error) {
          notification.error({
            message: t('auth.loginFailed'),
            description: t('auth.invalidCredentials'),
          });
        }
      });
    },
    [notification, t]
  );

  return (
    <Card className="login" title={<Typography.Title level={2}>{t('auth.login')}</Typography.Title>} type="inner">
      <Form layout="vertical" onFinish={handleSubmit}>
        <Form.Item label={t('auth.username')} name="username" rules={[{ required: true, type: 'string' }]} required>
          <Input placeholder={t('auth.enterUsername')} autoComplete="current-username" />
        </Form.Item>
        <Form.Item label={t('auth.password')} name="password" rules={[{ required: true, type: 'string' }]} required>
          <Input.Password placeholder={t('auth.enterPassword')} autoComplete="current-password" />
        </Form.Item>
        <Row gutter={[16, 16]} align="middle">
          <Col span={12}>
            <Button onClick={() => setOpen(true)}>{t('auth.register')}</Button>
          </Col>
          <Col span={12}>
            <Button type="primary" htmlType="submit">
              {t('auth.login')}
            </Button>
          </Col>
        </Row>
      </Form>
      <RegistrationModal open={open} setOpen={setOpen} />
    </Card>
  );
}
