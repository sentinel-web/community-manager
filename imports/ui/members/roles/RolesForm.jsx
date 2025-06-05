import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { App, ColorPicker, Form, Input, Switch } from 'antd';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useCallback, useContext, useMemo } from 'react';
import { DrawerContext } from '../../app/App';
import FormFooter from '../../components/FormFooter';
import { getColorFromValues } from '../../specializations/SpecializationForm';

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

  return (
    <Form layout="vertical" form={form} onFinish={handleFinish} initialValues={model}>
      <Form.Item name="name" label="Name" rules={[{ required: true, type: 'string' }]} required>
        <Input placeholder="Enter name" />
      </Form.Item>
      <Form.Item name="description" label="Description" rules={[{ required: false, type: 'string' }]}>
        <Input.TextArea placeholder="Enter description" />
      </Form.Item>
      <Form.Item name="color" label="Color">
        <ColorPicker format="hex" />
      </Form.Item>
      <RuleInput name="dashboard" label="Dashboard" />
      <RuleInput name="orbat" label="Orbat" />
      <RuleInput name="tasks" label="Tasks" />
      <RuleInput name="taskStatus" label="Task Status" />
      <RuleInput name="events" label="Events" />
      <RuleInput name="eventTypes" label="Event Types" />
      <RuleInput name="squads" label="Squads" />
      <RuleInput name="members" label="Members" />
      <RuleInput name="ranks" label="Ranks" />
      <RuleInput name="specializations" label="Specializations" />
      <RuleInput name="medals" label="Medals" />
      <RuleInput name="registrations" label="Registrations" />
      <RuleInput name="discoveryTypes" label="Discovery Types" />
      <RuleInput name="roles" label="Roles" />
      <RuleInput name="settings" label="Settings" />
      <FormFooter setOpen={setOpen} />
    </Form>
  );
};
RolesForm.propTypes = {
  setOpen: PropTypes.func,
};

const RuleInput = ({ name, label }) => {
  return (
    <Form.Item name={name} label={label} rules={[{ required: false, type: 'boolean' }]}>
      <Switch checkedChildren={<CheckOutlined />} unCheckedChildren={<CloseOutlined />} />
    </Form.Item>
  );
};
RuleInput.propTypes = {
  name: PropTypes.string,
  label: PropTypes.string,
};

export default RolesForm;
