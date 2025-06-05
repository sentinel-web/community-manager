import { App, Form, Select } from 'antd';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useCallback, useContext } from 'react';
import TaskStatusCollection from '../../api/collections/taskStatus.collection';
import { DrawerContext } from '../app/App';
import CollectionSelect from '../components/CollectionSelect';
import FormFooter from '../components/FormFooter';
import MembersSelect from '../members/MembersSelect';
import TaskStatusForm from './task-status/TaskStatusForm';

const TaskFilter = ({ setOpen }) => {
  const { drawerModel: model } = useContext(DrawerContext);
  const { notification } = App.useApp();
  const [form] = Form.useForm();

  const handleFinish = useCallback(
    async values => {
      Meteor.callAsync('members.update', Meteor.userId(), { 'profile.taskFilter': values })
        .then(() => {
          setOpen(false);
        })
        .catch(error => {
          notification.error({
            message: error.error,
            description: error.message,
          });
        });
    },
    [setOpen, notification]
  );

  return (
    <Form layout="vertical" form={form} onFinish={handleFinish} initialValues={model || { type: 'table', status: [], participants: [] }}>
      <Form.Item label="Type" name="type" rules={[{ required: false, type: 'string' }]}>
        <Select
          placeholder="Select type"
          allowClear
          options={[
            { value: 'table', label: 'Table' },
            { value: 'kanban', label: 'Kanban' },
          ]}
        />
      </Form.Item>
      <CollectionSelect
        defaultValue={model?.status}
        name="status"
        label="Status"
        rules={[{ required: false, type: 'array' }]}
        placeholder="Select status"
        FormComponent={TaskStatusForm}
        collection={TaskStatusCollection}
        mode="multiple"
        subscription="taskStatus"
      />
      <MembersSelect
        name="participants"
        label="Participants"
        rules={[{ required: false, type: 'array' }]}
        placeholder="Select participants"
        defaultValue={model?.participants}
        multiple
      />
      <FormFooter setOpen={setOpen} />
    </Form>
  );
};
TaskFilter.propTypes = {
  setOpen: PropTypes.func,
};

export default TaskFilter;
