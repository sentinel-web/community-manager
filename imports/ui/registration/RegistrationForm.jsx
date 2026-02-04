import { Alert, App, Button, Col, Form, Input, InputNumber, Row, Switch, Tooltip } from 'antd';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import DiscoveryTypesCollection from '../../api/collections/discoveryTypes.collection';
import { useTranslation } from '../../i18n/LanguageContext';
import { DrawerContext } from '../app/App';
import CollectionSelect from '../components/CollectionSelect';
import DiscoveryTypeForm from './discovery-types/DiscoveryTypesForm';

export default function RegistrationForm({ setOpen }) {
  const [form] = Form.useForm();
  const drawer = useContext(DrawerContext);
  const { message, notification } = App.useApp();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [disableSubmit, setDisableSubmit] = useState(false);
  const [nameError, setNameError] = useState(undefined);
  const [idError, setIdError] = useState(undefined);

  const model = useMemo(() => {
    if (!Meteor.user()) return {};
    return drawer.drawerModel || {};
  }, [drawer.drawerModel]);

  useEffect(() => {
    if (Object.keys(model).length > 0) {
      form.setFieldsValue(model);
    } else {
      form.setFieldsValue({
        name: '',
        id: null,
        age: null,
        discoveryType: null,
        rulesReadAndAccepted: false,
        description: '',
      });
    }
  }, [model, form.setFieldsValue]);

  const validateName = useCallback(() => {
    const value = form.getFieldValue('name');
    setNameError('validating');
    Meteor.callAsync('registrations.validateName', value, model?._id)
      .then(result => {
        setNameError(result ? 'success' : 'error');
        setDisableSubmit(!result);
      })
      .catch(error => {
        console.error(error);
        setNameError('warning');
      });
  }, [form.getFieldValue, model?._id]);

  const validateId = useCallback(() => {
    const value = form.getFieldValue('id');
    setIdError('validating');
    Meteor.callAsync('registrations.validateId', value, model?._id)
      .then(result => {
        setIdError(result ? 'success' : 'error');
        setDisableSubmit(!result);
      })
      .catch(error => {
        console.error(error);
        setIdError('warning');
      });
  }, [form.getFieldValue, model?._id]);

  const handleSubmit = useCallback(
    values => {
      setLoading(true);
      const { name, id, age, discoveryType, rulesReadAndAccepted, description } = values;
      const args = [...(model?._id ? [model._id] : []), { name, id, age, discoveryType, rulesReadAndAccepted, description }];
      Meteor.callAsync(Meteor.user() && model?._id ? 'registrations.update' : 'registrations.insert', ...args)
        .then(() => {
          setOpen(false);
          form.resetFields();
          message.success(t('messages.registrationSuccessful'));
        })
        .catch(error => {
          console.error(error);
          notification.error({
            message: error.error,
            description: error.message,
          });
        })
        .finally(() => setLoading(false));
    },
    [setOpen, form, model, message, notification]
  );

  const handleValuesChange = useCallback(
    (changedValues, values) => {
      if ('name' in (values ?? {})) {
        validateName();
      }
      if ('id' in (values ?? {})) {
        validateId();
      }
      if ('rulesReadAndAccepted' in (changedValues ?? {}) && 'rulesReadAndAccepted' in (values ?? {})) {
        setDisableSubmit(!values.rulesReadAndAccepted);
      }
    },
    [validateId, validateName]
  );

  useEffect(() => {
    handleValuesChange(model ?? {});
  }, [model, handleValuesChange]);

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit} onValuesChange={handleValuesChange} disabled={loading}>
      {(nameError === 'error' || idError === 'error') && (
        <Alert
          className="alert"
          type="error"
          description={
            <Row gutter={[16, 16]}>
              {nameError === 'error' && <Col span={24}>{t('forms.errors.nameAlreadyInUse')}</Col>}
              {idError === 'error' && <Col span={24}>{t('forms.errors.idAlreadyInUse')}</Col>}
            </Row>
          }
        />
      )}
      <Form.Item name="name" label={t('forms.labels.desiredName')} rules={[{ required: true, type: 'string' }]} status={nameError} required>
        <Input placeholder={t('forms.placeholders.enterDesiredName')} />
      </Form.Item>
      <Form.Item
        name="id"
        label={t('forms.labels.desiredId')}
        rules={[
          { required: true, type: 'number' },
          { min: 1000, max: 9999, type: 'number' },
        ]}
        status={idError}
        required
      >
        <InputNumber min={1000} max={9999} step={1} placeholder={t('forms.placeholders.enterDesiredId')} />
      </Form.Item>
      <Form.Item
        name="age"
        label={t('forms.labels.age')}
        rules={[
          { required: true, type: 'number' },
          { type: 'number', min: 16 },
        ]}
        required
      >
        <InputNumber min={16} step={1} placeholder={t('forms.placeholders.enterAge')} />
      </Form.Item>
      <CollectionSelect
        defaultValue={model?.discoveryType}
        name="discoveryType"
        subscription="discoveryTypes"
        label={t('forms.labels.discoveryType')}
        rules={[{ required: false, type: 'string' }]}
        placeholder={t('forms.placeholders.selectDiscoveryType')}
        collection={DiscoveryTypesCollection}
        FormComponent={DiscoveryTypeForm}
      />
      <Form.Item name="rulesReadAndAccepted" label={t('forms.labels.rulesAccepted')} rules={[{ required: true, type: 'boolean' }]} required>
        <Switch />
      </Form.Item>
      {Meteor.user() && (
        <Form.Item name="description" label={t('common.description')} rules={[{ type: 'string' }]}>
          <Input.TextArea autoSize placeholder={t('forms.placeholders.enterDescription')} />
        </Form.Item>
      )}
      <Row gutter={[16, 16]} align="middle" justify="end">
        <Col>
          <Button onClick={() => setOpen(false)} danger>
            {t('common.cancel')}
          </Button>
        </Col>
        <Col>
          <Tooltip title={disableSubmit ? t('forms.tooltips.pleaseReadAndAcceptRules') : ''}>
            <Button type="primary" htmlType="submit" loading={loading} disabled={disableSubmit}>
              {t('common.submit')}
            </Button>
          </Tooltip>
        </Col>
      </Row>
    </Form>
  );
}
RegistrationForm.propTypes = {
  setOpen: PropTypes.func,
};
