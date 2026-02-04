import { Alert, App, Button, Col, Form, Input, InputNumber, Row, Switch, Tooltip } from 'antd';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import DiscoveryTypesCollection from '../../api/collections/discoveryTypes.collection';
import { DrawerContext } from '../app/App';
import CollectionSelect from '../components/CollectionSelect';
import DiscoveryTypeForm from './discovery-types/DiscoveryTypesForm';

export default function RegistrationForm({ setOpen }) {
  const [form] = Form.useForm();
  const drawer = useContext(DrawerContext);
  const { message, notification } = App.useApp();
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
      .catch(() => {
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
      .catch(() => {
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
          message.success('Registration successful');
        })
        .catch(error => {
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
              {nameError === 'error' && <Col span={24}>Name already in use</Col>}
              {idError === 'error' && <Col span={24}>ID already in use</Col>}
            </Row>
          }
        />
      )}
      <Form.Item name="name" label="Desired Name" rules={[{ required: true, type: 'string' }]} status={nameError} required>
        <Input placeholder="Enter desired name" />
      </Form.Item>
      <Form.Item
        name="id"
        label="Desired ID"
        rules={[
          { required: true, type: 'number' },
          { min: 1000, max: 9999, type: 'number' },
        ]}
        status={idError}
        required
      >
        <InputNumber min={1000} max={9999} step={1} placeholder="Enter desired ID" />
      </Form.Item>
      <Form.Item
        name="age"
        label="Age"
        rules={[
          { required: true, type: 'number' },
          { type: 'number', min: 16 },
        ]}
        required
      >
        <InputNumber min={16} step={1} placeholder="Enter age" />
      </Form.Item>
      <CollectionSelect
        defaultValue={model?.discoveryType}
        name="discoveryType"
        subscription="discoveryTypes"
        label="Discovery Type"
        rules={[{ required: false, type: 'string' }]}
        placeholder="Select discovery type"
        collection={DiscoveryTypesCollection}
        FormComponent={DiscoveryTypeForm}
      />
      <Form.Item name="rulesReadAndAccepted" label="I read the rules and accept them" rules={[{ required: true, type: 'boolean' }]} required>
        <Switch />
      </Form.Item>
      {Meteor.user() && (
        <Form.Item name="description" label="Description" rules={[{ type: 'string' }]}>
          <Input.TextArea autoSize placeholder="Enter description" />
        </Form.Item>
      )}
      <Row gutter={[16, 16]} align="middle" justify="end">
        <Col>
          <Button onClick={() => setOpen(false)} danger>
            Cancel
          </Button>
        </Col>
        <Col>
          <Tooltip title={disableSubmit ? 'Please read and accept the rules' : ''}>
            <Button type="primary" htmlType="submit" loading={loading} disabled={disableSubmit}>
              Submit
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
