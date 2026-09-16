import { App, Button, Card, Col, Form, Input, Modal, Result, Row, Typography } from 'antd';
import { Meteor } from 'meteor/meteor';
import React, { useCallback, useState } from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';
import { useDrawerStack } from '../drawer-stack';
import RegistrationForm from '../registration/RegistrationForm';

interface LoginValues {
  username: string;
  password: string;
}

export default function Login() {
  const { t } = useTranslation();
  const { notification } = App.useApp();
  const drawerStack = useDrawerStack();
  const [registrationReceived, setRegistrationReceived] = useState(false);

  const handleSubmit = useCallback(
    (values: LoginValues) => {
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

  const handleRegister = useCallback(async () => {
    // Resolves with the new registration id on submit, undefined on cancel.
    const registrationId = await drawerStack.push<string, Record<string, unknown>>({
      title: t('modals.registration'),
      Component: RegistrationForm,
      model: {},
    });
    if (registrationId) setRegistrationReceived(true);
  }, [drawerStack, t]);

  const closeConfirmation = useCallback(() => setRegistrationReceived(false), []);

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
          <Col xs={24} md={12}>
            <Button onClick={() => void handleRegister()}>{t('auth.register')}</Button>
          </Col>
          <Col xs={24} md={12}>
            <Button type="primary" htmlType="submit">
              {t('auth.login')}
            </Button>
          </Col>
        </Row>
      </Form>
      <Modal open={registrationReceived} onCancel={closeConfirmation} footer={null} centered>
        <Result
          status="success"
          title={t('registrations.confirmation.title')}
          subTitle={t('registrations.confirmation.description')}
          extra={
            <Button type="primary" onClick={closeConfirmation}>
              {t('common.close')}
            </Button>
          }
        />
      </Modal>
    </Card>
  );
}
