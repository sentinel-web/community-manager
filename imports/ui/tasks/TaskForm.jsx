import { App, Form, Input, Select } from 'antd';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import TasksCollection from '../../api/collections/tasks.collection';
import TaskStatusCollection from '../../api/collections/taskStatus.collection';
import { DrawerContext } from '../app/App';
import CollectionSelect from '../components/CollectionSelect';
import FormFooter from '../components/FormFooter';
import TaskStatusForm from './task-status/TaskStatusForm';

TaskForm.propTypes = {
  setOpen: PropTypes.func,
};
const TaskForm = ({ setOpen }) => {
  const { drawerModel: model } = useContext(DrawerContext);
  const { message, notification } = App.useApp();
  const { isUpdate, endpoint } = useMemo(
    () => (model?._id ? { isUpdate: true, endpoint: 'tasks.update' } : { isUpdate: false, endpoint: 'tasks.insert' }),
    [model?._id]
  );

  const handleFinish = useCallback(
    async values => {
      try {
        const args = isUpdate ? [model._id, values] : [values];
        await Meteor.callAsync(endpoint, ...args);
        setOpen(false);
        message.success(isUpdate ? 'Task updated' : 'Task created');
      } catch (error) {
        notification.error({
          message: error.error,
          description: error.message,
        });
      }
    },
    [setOpen, endpoint, model?._id, isUpdate, message, notification]
  );

  const [participantOptions, setParticipantOptions] = useState([]);
  useEffect(() => {
    Meteor.callAsync('members.options')
      .then(res => setParticipantOptions(res))
      .catch(console.error);
  }, []);

  const [form] = Form.useForm();

  return (
    <Form layout="vertical" form={form} onFinish={handleFinish} initialValues={model}>
      <Form.Item label="Name" name="name" rules={[{ required: true, type: 'string' }]} required>
        <Input placeholder="Enter name" />
      </Form.Item>
      <CollectionSelect
        defaultValue={model?.status}
        name="status"
        label="Task Status"
        rules={[{ required: true, type: 'string' }]}
        collection={TaskStatusCollection}
        subscription="taskStatus"
        FormComponent={TaskStatusForm}
      />
      <Form.Item label="Participants" name="participants" rules={[{ required: false, type: 'array' }]}>
        <Select mode="multiple" placeholder="Select participants" allowClear options={participantOptions} optionFilterProp="label" />
      </Form.Item>
      <Form.Item label="Priority" name="priority" rules={[{ required: false, type: 'string' }]}>
        <Select
          placeholder="Select priority"
          allowClear
          options={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
          ]}
        />
      </Form.Item>
      <Form.Item label="Link" name="link" rules={[{ required: false, type: 'url' }]}>
        <Input placeholder="Enter link" />
      </Form.Item>
      <Form.Item label="Description" name="description" rules={[{ required: false, type: 'string' }]}>
        <Input.TextArea autoSize placeholder="Enter description" />
      </Form.Item>
      <CollectionSelect
        defaultValue={model?.parent}
        name="parent"
        label="Parent Task"
        rules={[{ required: false, type: 'string' }]}
        collection={TasksCollection}
        subscription="tasks"
        FormComponent={TaskForm}
      />
      <FormFooter setOpen={setOpen} />
    </Form>
  );
};

export default TaskForm;
