import { App, Button, Col, ColorPicker, Form, Input, Row } from 'antd';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { DrawerContext, SubdrawerContext } from '../../app/App';
import { getColorFromValues } from '../../specializations/SpecializationForm';

export default function EventTypesForm({ setOpen, useSubdrawer }) {
  const [form] = Form.useForm();
  const { message, notification } = App.useApp();
  const [loading, setLoading] = useState(false);

  const drawer = useContext(useSubdrawer ? SubdrawerContext : DrawerContext);
  const model = useMemo(() => {
    return drawer.drawerModel || {};
  }, [drawer]);

  useEffect(() => {
    if (Object.keys(model).length > 0) {
      form.setFieldsValue(model);
    } else {
      form.setFieldsValue({
        name: '',
        description: '',
        color: null,
      });
    }
  }, [model, form.setFieldsValue]);

  const handleSubmit = useCallback(
    values => {
      setLoading(true);
      const { name, description } = values;
      const args = [...(model?._id ? [model._id] : []), { name, color: getColorFromValues(values), description }];
      Meteor.callAsync(Meteor.user() && model?._id ? 'eventTypes.update' : 'eventTypes.insert', ...args)
        .then(() => {
          setOpen(false);
          form.resetFields();
          message.success(`Event type ${model?._id ? 'updated' : 'created'} successfully`);
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

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit} disabled={loading}>
      <Form.Item name="name" label="Name" rules={[{ required: true, type: 'string' }]} required>
        <Input placeholder="Enter name" />
      </Form.Item>
      <Form.Item name="description" label="Description" rules={[{ required: false, type: 'string' }]}>
        <Input.TextArea placeholder="Enter description" />
      </Form.Item>
      <Form.Item name="color" label="Color">
        <ColorPicker format="hex" />
      </Form.Item>
      <Row gutter={[16, 16]} align="middle" justify="end">
        <Col>
          <Button onClick={() => setOpen(false)} danger>
            Cancel
          </Button>
        </Col>
        <Col>
          <Button type="primary" htmlType="submit" loading={loading}>
            Submit
          </Button>
        </Col>
      </Row>
    </Form>
  );
}

