import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { App, Card, Checkbox, ColorPicker, Form, Input, Space, Switch, Typography } from 'antd';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useCallback, useContext, useMemo } from 'react';
import { DrawerContext } from '../../app/App';
import FormFooter from '../../components/FormFooter';
import { getColorFromValues } from '../../specializations/SpecializationForm';

// Modules that use boolean permissions (true/false)
const BOOLEAN_MODULES = ['dashboard', 'orbat', 'logs', 'settings'];

// Modules that use CRUD permissions
const CRUD_MODULES = [
  { name: 'members', label: 'Members' },
  { name: 'events', label: 'Events' },
  { name: 'tasks', label: 'Tasks' },
  { name: 'squads', label: 'Squads' },
  { name: 'ranks', label: 'Ranks' },
  { name: 'specializations', label: 'Specializations' },
  { name: 'medals', label: 'Medals' },
  { name: 'eventTypes', label: 'Event Types' },
  { name: 'taskStatus', label: 'Task Status' },
  { name: 'registrations', label: 'Registrations' },
  { name: 'discoveryTypes', label: 'Discovery Types' },
  { name: 'roles', label: 'Roles' },
  { name: 'questionnaires', label: 'Questionnaires' },
];

/**
 * Normalizes permission value for form initial values.
 * Converts old boolean format to CRUD object format.
 */
function normalizePermissionForForm(value) {
  if (value === true) {
    return { read: true, create: true, update: true, delete: true };
  }
  if (value === false || value === undefined) {
    return { read: false, create: false, update: false, delete: false };
  }
  return value;
}

/**
 * Prepares model for form initialization by normalizing CRUD permissions.
 */
function prepareModelForForm(model) {
  if (!model) return {};

  const prepared = { ...model };
  for (const { name } of CRUD_MODULES) {
    prepared[name] = normalizePermissionForForm(model[name]);
  }
  return prepared;
}

const RolesForm = ({ setOpen }) => {
  const { drawerModel: model } = useContext(DrawerContext);
  const { message, notification } = App.useApp();
  const { isUpdate, endpoint } = useMemo(
    () => (model?._id ? { isUpdate: true, endpoint: 'roles.update' } : { isUpdate: false, endpoint: 'roles.insert' }),
    [model?._id]
  );

  const handleFinish = useCallback(
    async values => {
      try {
        const args = [...(model?._id ? [model._id] : []), { ...values, color: getColorFromValues(values) }];
        await Meteor.callAsync(endpoint, ...args);
        setOpen(false);
        message.success(isUpdate ? 'Role updated' : 'Role created');
      } catch (error) {
        notification.error({
          message: error.error,
          description: error.message,
        });
      }
    },
    [setOpen, endpoint, model?._id, isUpdate, message, notification]
  );

  const [form] = Form.useForm();
  const initialValues = useMemo(() => prepareModelForForm(model), [model]);

  return (
    <Form layout="vertical" form={form} onFinish={handleFinish} initialValues={initialValues}>
      <Form.Item name="name" label="Name" rules={[{ required: true, type: 'string' }]} required>
        <Input placeholder="Enter name" />
      </Form.Item>
      <Form.Item name="description" label="Description" rules={[{ required: false, type: 'string' }]}>
        <Input.TextArea placeholder="Enter description" />
      </Form.Item>
      <Form.Item name="color" label="Color">
        <ColorPicker format="hex" />
      </Form.Item>

      <Typography.Title level={5} style={{ marginTop: 16 }}>
        Basic Permissions
      </Typography.Title>
      <RuleInput name="dashboard" label="Dashboard" />
      <RuleInput name="orbat" label="Orbat" />
      <RuleInput name="logs" label="Logs" />
      <RuleInput name="settings" label="Settings" />

      <Typography.Title level={5} style={{ marginTop: 16 }}>
        CRUD Permissions
      </Typography.Title>
      {CRUD_MODULES.map(({ name, label }) => (
        <CrudPermissionInput key={name} name={name} label={label} />
      ))}

      <FormFooter setOpen={setOpen} />
    </Form>
  );
};
RolesForm.propTypes = {
  setOpen: PropTypes.func,
};

const RuleInput = ({ name, label }) => {
  return (
    <Form.Item name={name} label={label} rules={[{ required: false, type: 'boolean' }]} valuePropName="checked">
      <Switch checkedChildren={<CheckOutlined />} unCheckedChildren={<CloseOutlined />} />
    </Form.Item>
  );
};
RuleInput.propTypes = {
  name: PropTypes.string,
  label: PropTypes.string,
};

const CrudPermissionInput = ({ name, label }) => {
  return (
    <Card size="small" title={label} style={{ marginBottom: 16 }}>
      <Space wrap>
        <Form.Item name={[name, 'read']} valuePropName="checked" style={{ marginBottom: 0 }}>
          <Checkbox>Read</Checkbox>
        </Form.Item>
        <Form.Item name={[name, 'create']} valuePropName="checked" style={{ marginBottom: 0 }}>
          <Checkbox>Create</Checkbox>
        </Form.Item>
        <Form.Item name={[name, 'update']} valuePropName="checked" style={{ marginBottom: 0 }}>
          <Checkbox>Update</Checkbox>
        </Form.Item>
        <Form.Item name={[name, 'delete']} valuePropName="checked" style={{ marginBottom: 0 }}>
          <Checkbox>Delete</Checkbox>
        </Form.Item>
      </Space>
    </Card>
  );
};
CrudPermissionInput.propTypes = {
  name: PropTypes.string,
  label: PropTypes.string,
};

export default RolesForm;
