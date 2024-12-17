import { App, Button, Col, Form, Input, Row, Select } from 'antd';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { DrawerContext } from '../app/App';

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

  const [options, setOptions] = useState([]);
  useEffect(() => {
    Meteor.callAsync('members.options').then(res => setOptions(res));
  }, []);

  return (
    <Form layout="vertical" onFinish={handleFinish} initialValues={model}>
      <Form.Item label="Name" name="name" rules={[{ required: true, type: 'string' }]} required>
        <Input placeholder="Enter name" />
      </Form.Item>
      <Form.Item label="Status" name="status" rules={[{ required: true, type: 'string' }]} required>
        <Select
          placeholder="Select status"
          options={[
            { label: 'Open', value: 'open' },
            { label: 'In Progress', value: 'in-progress' },
            { label: 'Done', value: 'done' },
          ]}
        />
      </Form.Item>
      <Form.Item label="Participants" name="participants" rules={[{ required: false, type: 'array' }]}>
        <Select mode="multiple" placeholder="Select participants" allowClear options={options} optionFilterProp="label" />
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
