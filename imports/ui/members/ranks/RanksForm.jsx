import { App, ColorPicker, Form, Input, Select } from 'antd';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DrawerContext, SubdrawerContext } from '../../app/App';
import FormFooter from '../../components/FormFooter';
import { getColorFromValues } from '../../specializations/SpecializationForm';
import RanksSelect from './RanksSelect';

export default function RanksForm({ setOpen, useSubdrawer }) {
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
        previousRankId: null,
        nextRankId: null,
      });
    }
  }, [model, form.setFieldsValue]);

  const handleSubmit = useCallback(
    values => {
      setLoading(true);
      const { name, description, previousRankId, nextRankId, type } = values;
      const args = [...(model?._id ? [model._id] : []), { name, color: getColorFromValues(values), description, previousRankId, nextRankId, type }];
      Meteor.callAsync(Meteor.user() && model?._id ? 'ranks.update' : 'ranks.insert', ...args)
        .then(() => {
          setOpen(false);
          form.resetFields();
          message.success(`Rank ${model?._id ? 'updated' : 'created'} successfully`);
        })
        .catch(error => {
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
      <Form.Item name="type" label="Type" rules={[{ required: true, type: 'string' }]} required>
        <Select
          placeholder="Select type"
          options={[
            { label: 'Player Rank', value: 'player' },
            { label: 'Zeus Rank', value: 'zeus' },
          ]}
        />
      </Form.Item>
      <Form.Item name="description" label="Description" rules={[{ required: false, type: 'string' }]}>
        <Input.TextArea autoSize placeholder="Enter description" />
      </Form.Item>
      <Form.Item name="color" label="Color">
        <ColorPicker format="hex" />
      </Form.Item>
      <RanksSelect name="previousRankId" label="Previous Rank" rules={[{ required: false, type: 'string' }]} defaultValue={model?.previousRankId} />
      <RanksSelect name="nextRankId" label="Next Rank" rules={[{ required: false, type: 'string' }]} defaultValue={model?.nextRankId} />
      <FormFooter setOpen={setOpen} />
    </Form>
  );
}
RanksForm.propTypes = {
  setOpen: PropTypes.func,
  useSubdrawer: PropTypes.bool,
};
