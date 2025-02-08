import { Alert, App, Button, Col, Form, Input, InputNumber, Row, Select, Switch, Tag, Tooltip } from 'antd';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { DrawerContext, SubdrawerContext } from '../app/App';
import useDiscoveryTypes from './discovery-types/discovery-types.hook';
import DiscoveryTypeForm from './discovery-types/DiscoveryTypesForm';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import DiscoveryTypesCollection from '../../api/collections/discoveryTypes.collection';

const empty = <></>;

export default function RegistrationForm({ setOpen }) {
  const { modal } = App.useApp();
  const [form] = Form.useForm();
  const drawer = useContext(DrawerContext);
  const subdrawer = useContext(SubdrawerContext);
  const { message, notification } = App.useApp();

  const { ready, discoveryTypes } = useDiscoveryTypes();

  const discoveryTypesOptions = useMemo(() => {
    if (ready) {
      return discoveryTypes.map(discoveryType => {
        return {
          label: discoveryType.name,
          value: discoveryType._id,
          title: `${discoveryType.name}${discoveryType?.description ? ` - ${discoveryType.description}` : ''}`,
        };
      });
    }
    return [];
  }, [ready, discoveryTypes]);

  const handleCreate = useCallback(() => {
    subdrawer.setDrawerTitle('Create Discovery Type');
    subdrawer.setDrawerModel({});
    subdrawer.setDrawerComponent(<DiscoveryTypeForm setOpen={subdrawer.setDrawerOpen} useSubdrawer />);
    subdrawer.setDrawerExtra(empty);
    subdrawer.setDrawerOpen(true);
  }, [subdrawer]);

  const [loading, setLoading] = useState(false);
  const [disableSubmit, setDisableSubmit] = useState(false);
  const [nameError, setNameError] = useState(undefined);
  const [idError, setIdError] = useState(undefined);

  const model = useMemo(() => {
    return drawer.drawerModel || {};
  }, [drawer]);

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
        setNameError('warning');
      });
  }, [form, model]);

  const validateId = useCallback(() => {
    const value = form.getFieldValue('id');
    setIdError('validating');
    Meteor.callAsync('registrations.validateId', value, model?._id)
      .then(result => {
        setIdError(result ? 'success' : 'error');
        setDisableSubmit(!result);
      })
      .catch(error => {
        setIdError('warning');
      });
  }, [form.getFieldValue, model]);

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

  const handleEdit = useCallback(
    async (e, value) => {
      e.preventDefault();
      e.stopPropagation();
      const model = await DiscoveryTypesCollection.findOneAsync(value);
      subdrawer.setDrawerTitle('Edit Discovery Type');
      subdrawer.setDrawerModel(model);
      subdrawer.setDrawerComponent(<DiscoveryTypeForm setOpen={subdrawer.setDrawerOpen} useSubdrawer />);
      subdrawer.setDrawerOpen(true);
    },
    [subdrawer]
  );

  const handleDelete = useCallback(
    async (e, value) => {
      e.preventDefault();
      e.stopPropagation();
      modal.confirm({
        title: 'Are you sure you want to delete this discovery type?',
        okText: 'Delete',
        onOk: async () => {
          await Meteor.callAsync('discoveryTypes.remove', value);
        },
      });
    },
    [modal]
  );

  const optionRender = useCallback(
    ({ label, value }) => {
      const discoveryType = DiscoveryTypesCollection.findOne(value);
      return (
        <Row gutter={[16, 16]} align="middle" justify="space-between" key={value}>
          <Col flex="auto">
            <Tag color={discoveryType?.color}>{label}</Tag>
          </Col>
          {Meteor.user() && (
            <Col>
              <Button icon={<EditOutlined />} onClick={e => handleEdit(e, value)} type="text" size="small" />
            </Col>
          )}
          {Meteor.user() && (
            <Col>
              <Button icon={<DeleteOutlined />} onClick={e => handleDelete(e, value)} type="text" size="small" danger />
            </Col>
          )}
        </Row>
      );
    },
    [handleEdit, handleDelete]
  );

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
      <Row gutter={8} justify="space-between" align="middle">
        <Col flex="auto">
          <Form.Item name="discoveryType" label="Discovery Type">
            <Select
              placeholder="Select discovery type"
              loading={!ready}
              options={discoveryTypesOptions}
              optionRender={optionRender}
              filterSort={(optionA, optionB) => optionA.label.localeCompare(optionB.label)}
              optionFilterProp="label"
              showSearch
            />
          </Form.Item>
        </Col>
        {Meteor.user() && (
          <Col>
            <Button icon={<PlusOutlined />} onClick={handleCreate} style={{ marginTop: 8 }} />
          </Col>
        )}
      </Row>
      <Form.Item name="rulesReadAndAccepted" label="I read the rules and accept them" rules={[{ required: true, type: 'boolean' }]} required>
        <Switch />
      </Form.Item>
      {Meteor.user() && (
        <Form.Item name="description" label="Description" rules={[{ type: 'string' }]}>
          <Input.TextArea placeholder="Enter description" />
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
