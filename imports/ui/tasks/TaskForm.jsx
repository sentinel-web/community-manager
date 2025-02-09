import { App, Button, Col, Form, Input, Row, Select, Tag } from 'antd';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { DrawerContext, SubdrawerContext } from '../app/App';
import useTaskStatus from './task-status/task-status.hook';
import TaskStatusCollection from '../../api/collections/taskStatus.collection';
import TaskStatusForm from './task-status/TaskStatusForm';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';

const empty = <></>;

const TaskForm = ({ setOpen }) => {
  const { drawerModel: model } = useContext(DrawerContext);
  const subdrawer = useContext(SubdrawerContext);
  const { message, notification, modal } = App.useApp();
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

  const { ready, taskStatus } = useTaskStatus();
  const taskStatusOptions = useMemo(() => {
    return ready ? taskStatus.map(status => ({ label: status.name, value: status._id, title: status.description })) : [];
  }, [ready, taskStatus]);

  const handleEdit = useCallback(
    async (e, value) => {
      e.preventDefault();
      e.stopPropagation();
      const model = await TaskStatusCollection.findOneAsync(value);
      subdrawer.setDrawerTitle('Edit Task Status');
      subdrawer.setDrawerModel(model);
      subdrawer.setDrawerComponent(<TaskStatusForm setOpen={subdrawer.setDrawerOpen} useSubdrawer />);
      subdrawer.setDrawerOpen(true);
    },
    [subdrawer]
  );

  const handleDelete = useCallback(
    async (e, value) => {
      e.preventDefault();
      e.stopPropagation();
      modal.confirm({
        title: 'Are you sure you want to delete this task status?',
        okText: 'Delete',
        onOk: async () => {
          await Meteor.callAsync('taskStatus.remove', value);
        },
      });
    },
    [modal]
  );

  const optionRender = useCallback(
    ({ label, value }) => {
      const match = TaskStatusCollection.findOne(value);
      return (
        <Row gutter={[16, 16]} align="middle" justify="space-between" key={value}>
          <Col flex="auto">
            <Tag color={match?.color}>{label}</Tag>
          </Col>
          <Col>
            <Button icon={<EditOutlined />} onClick={e => handleEdit(e, value)} type="text" size="small" />
          </Col>
          <Col>
            <Button icon={<DeleteOutlined />} onClick={e => handleDelete(e, value)} type="text" size="small" danger />
          </Col>
        </Row>
      );
    },
    [handleEdit, handleDelete]
  );

  const handleCreate = useCallback(() => {
    subdrawer.setDrawerTitle('Create Task Status');
    subdrawer.setDrawerModel({});
    subdrawer.setDrawerComponent(<TaskStatusForm setOpen={subdrawer.setDrawerOpen} useSubdrawer />);
    subdrawer.setDrawerExtra(empty);
    subdrawer.setDrawerOpen(true);
  }, [subdrawer]);

  return (
    <Form layout="vertical" onFinish={handleFinish} initialValues={model}>
      <Form.Item label="Name" name="name" rules={[{ required: true, type: 'string' }]} required>
        <Input placeholder="Enter name" />
      </Form.Item>
      <Row gutter={8} justify="space-between" align="middle">
        <Col flex="auto">
          <Form.Item label="Status" name="status" rules={[{ required: true, type: 'string' }]} required>
            <Select
              placeholder="Select status"
              optionRender={optionRender}
              options={taskStatusOptions}
              optionFilterProp="label"
              loading={!ready}
              showSearch
            />
          </Form.Item>
        </Col>
        <Col>
          <Button icon={<PlusOutlined />} onClick={handleCreate} style={{ marginTop: 8 }} />
        </Col>
      </Row>
      <Form.Item label="Participants" name="participants" rules={[{ required: false, type: 'array' }]}>
        <Select mode="multiple" placeholder="Select participants" allowClear options={participantOptions} optionFilterProp="label" />
      </Form.Item>
      <Form.Item label="Description" name="description" rules={[{ required: false, type: 'string' }]}>
        <Input.TextArea placeholder="Enter description" />
      </Form.Item>
      <Row gutter={[16, 16]} align="middle" justify="end">
        <Col>
          <Button onClick={() => setOpen(false)} danger>
            Cancel
          </Button>
        </Col>
        <Col>
          <Button type="primary" htmlType="submit">
            Submit
          </Button>
        </Col>
      </Row>
    </Form>
  );
};

export default TaskForm;
