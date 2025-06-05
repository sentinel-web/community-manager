import { App, ColorPicker, Form, Input } from 'antd';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DrawerContext, SubdrawerContext } from '../../app/App';
import FormFooter from '../../components/FormFooter';
import { getColorFromValues } from '../../specializations/SpecializationForm';

export default function DiscoveryTypeForm({ setOpen, useSubdrawer }) {
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
        id: null,
        age: null,
        discoveryType: null,
        rulesReadAndAccepted: false,
        description: '',
      });
    }
  }, [model, form.setFieldsValue]);

  const handleSubmit = useCallback(
    values => {
      setLoading(true);
      const { name, description } = values;
      const args = [...(model?._id ? [model._id] : []), { name, color: getColorFromValues(values), description }];
      Meteor.callAsync(Meteor.user() && model?._id ? 'discoveryTypes.update' : 'discoveryTypes.insert', ...args)
        .then(() => {
          setOpen(false);
          form.resetFields();
          message.success(`Discovery type ${model?._id ? 'updated' : 'created'} successful`);
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
      <Form.Item name="name" label="Desired Name" rules={[{ required: true, type: 'string' }]} required>
        <Input placeholder="Enter desired name" />
      </Form.Item>
      <Form.Item name="description" label="Description" rules={[{ required: false, type: 'string' }]}>
        <Input.TextArea autoSize placeholder="Enter description" />
      </Form.Item>
      <Form.Item name="color" label="Color">
        <ColorPicker format="hex" />
      </Form.Item>
      <FormFooter setOpen={setOpen} />
    </Form>
  );
}
DiscoveryTypeForm.propTypes = {
  setOpen: PropTypes.func,
  useSubdrawer: PropTypes.bool,
};
