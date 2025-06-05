import { DeleteOutlined, SaveOutlined } from '@ant-design/icons';
import { App, Button, Col, ColorPicker, DatePicker, Form, Input, Row, Switch } from 'antd';
import dayjs from 'dayjs';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useCallback, useContext, useMemo } from 'react';
import EventTypesCollection from '../../api/collections/eventTypes.collection';
import { DrawerContext } from '../app/App';
import CollectionSelect from '../components/CollectionSelect';
import MembersSelect from '../members/MembersSelect';
import { getColorFromValues } from '../specializations/SpecializationForm';
import EventTypesForm from './event-types/EventTypesForm';

const styles = {
  datePicker: {
    width: '100%',
  },
};

export const getDateFromValues = (values, key = 'date') => {
  if (values[key]) return values[key].toDate();
  return values[key];
};

const EventForm = ({ setOpen }) => {
  const { message, notification, modal } = App.useApp();
  const drawer = useContext(DrawerContext);

  const model = useMemo(() => {
    const data = drawer.drawerModel || {};
    return {
      ...data,
      start: data.start ? dayjs(data.start) : null,
      end: data.end ? dayjs(data.end) : null,
    };
  }, [drawer]);

  const handleFinish = useCallback(
    values => {
      values.color = getColorFromValues(values);
      values.start = getDateFromValues(values, 'start');
      values.end = getDateFromValues(values, 'end');
      const args = [...(model?._id ? [model._id] : []), values];
      const endpoint = model?._id ? 'events.update' : 'events.insert';
      const handleError = error => {
        notification.error({
          message: error.error,
          description: error.message,
        });
      };
      const handleSuccess = () => {
        const text = model?._id ? 'Event updated' : 'Event created';
        message.success(text);
        setOpen(false);
      };
      Meteor.callAsync(endpoint, ...args)
        .then(handleSuccess)
        .catch(handleError);
    },
    [model?._id, message, notification, setOpen]
  );

  const handleDelete = useCallback(() => {
    modal.confirm({
      title: 'Are you sure you want to delete this event?',
      okText: 'Delete',
      onOk: async () => {
        await Meteor.callAsync('events.remove', model._id)
          .then(() => {
            message.success('Event deleted');
            setOpen(false);
          })
          .catch(error => {
            notification.error({
              message: error.error,
              description: error.message,
            });
          });
      },
    });
  }, [modal, message, setOpen, model, notification]);

  const [form] = Form.useForm();

  return (
    <Form form={form} layout="vertical" initialValues={model} onFinish={handleFinish}>
      <Form.Item name="start" label="Start Date" rules={[{ required: true, type: 'date' }]}>
        <DatePicker style={styles.datePicker} showTime />
      </Form.Item>
      <Form.Item name="end" label="End Date" rules={[{ required: true, type: 'date' }]}>
        <DatePicker style={styles.datePicker} showTime />
      </Form.Item>
      <Form.Item name="name" label="Name" rules={[{ required: true, type: 'string' }]}>
        <Input placeholder="Enter title" />
      </Form.Item>
      <CollectionSelect
        defaultValue={model.eventType}
        name="eventType"
        label="Event Type"
        rules={[{ type: 'string' }]}
        collection={EventTypesCollection}
        subscription="eventTypes"
        FormComponent={EventTypesForm}
      />
      <MembersSelect multiple name="hosts" label="Hosts" rules={[{ type: 'array' }]} defaultValue={model.hosts} />
      <MembersSelect multiple name="attendees" label="Attendees" rules={[{ type: 'array' }]} defaultValue={model.attendees} />
      <Row gutter={[16, 16]} style={{ flexWrap: 'nowrap' }}>
        <Col flex="auto">
          <Form.Item name="isPrivate" label="Is Private" valuePropName="checked" rules={[{ type: 'boolean' }]}>
            <Switch />
          </Form.Item>
        </Col>
        <Col flex="auto">
          <Form.Item name="color" label="Color">
            <ColorPicker placeholder="Enter color" />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="preset" label="Preset Link" rules={[{ type: 'string' }]}>
        <Input placeholder="Enter preset link" />
      </Form.Item>
      <Form.Item name="description" label="Description" rules={[{ type: 'string' }]}>
        <Input.TextArea autoSize placeholder="Enter description" />
      </Form.Item>
      <Row gutter={[16, 16]} justify="end" align="middle">
        {model?._id && (
          <Col>
            <Button type="primary" onClick={handleDelete} icon={<DeleteOutlined />} danger>
              Delete
            </Button>
          </Col>
        )}
        <Col>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
            Save
          </Button>
        </Col>
      </Row>
    </Form>
  );
};
EventForm.propTypes = {
  setOpen: PropTypes.func,
};

export default EventForm;
