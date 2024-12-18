import { App, Button, Col, Form, Row, Select } from 'antd';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { DrawerContext } from '../app/App';
import useTaskStatus from './task-status/task-status.hook';

const TaskFilter = ({ setOpen }) => {
  const { drawerModel: model } = useContext(DrawerContext);
  const { notification } = App.useApp();

  const handleFinish = useCallback(
    async values => {
      Meteor.callAsync('members.update', Meteor.userId(), { taskFilter: values })
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

  const [participantOptions, setParticipantOptions] = useState([]);
  useEffect(() => {
    Meteor.callAsync('members.options')
      .then(res => setParticipantOptions(res))
      .catch(error => {
        notification.error({
          message: error.error,
          description: error.message,
        });
      });
  }, [notification]);

  const { ready, taskStatus } = useTaskStatus();
  const taskStatusOptions = useMemo(() => {
    return ready ? taskStatus.map(status => ({ value: status._id, label: status.name, title: status.description })) : [];
  }, [ready, taskStatus]);

  return (
    <Form layout="vertical" onFinish={handleFinish} initialValues={model || { status: [], participants: [] }}>
      <Form.Item label="Status" name="status" rules={[{ required: false, type: 'array' }]}>
        <Select mode="multiple" placeholder="Select status" loading={!ready} allowClear options={taskStatusOptions} optionFilterProp="label" />
      </Form.Item>
      <Form.Item label="Participants" name="participants" rules={[{ required: false, type: 'array' }]}>
        <Select mode="multiple" placeholder="Select participants" allowClear options={participantOptions} />
      </Form.Item>
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
      <Row gutter={[16, 16]} align="middle" justify="end">
        <Col>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
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

export default TaskFilter;
