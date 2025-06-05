import { App, Col, ColorPicker, Form, Input, Row } from 'antd';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useCallback, useContext, useMemo } from 'react';
import { DrawerContext, SubdrawerContext } from '../app/App';
import FormFooter from '../components/FormFooter';
import MembersSelect from '../members/MembersSelect';
import RanksSelect from '../members/ranks/RanksSelect';
import SpecializationsSelect from './SpecializationsSelect';

export function getColorFromValues(values) {
  return values?.color ? values.color?.toHexString?.() || values.color : values?.color;
}

SpecializationForm.propTypes = {
  setOpen: PropTypes.func,
  useSubdrawer: PropTypes.bool,
};
const SpecializationForm = ({ setOpen, useSubdrawer }) => {
  const drawer = useContext(DrawerContext);
  const subdrawer = useContext(SubdrawerContext);
  const { message, notification } = App.useApp();

  const { model, endpoint } = useMemo(() => {
    const newModel = (useSubdrawer ? subdrawer.drawerModel : drawer.drawerModel) || {};
    return { model: newModel, endpoint: newModel?._id ? 'specializations.update' : 'specializations.insert' };
  }, [drawer, subdrawer, useSubdrawer]);

  const handleFinish = useCallback(
    async values => {
      const color = getColorFromValues(values);
      values.color = color;
      const args = [...(model?._id ? [model._id] : []), values];
      Meteor.callAsync(endpoint, ...args)
        .then(() => {
          message.success(`Specialization ${model?._id ? 'updated' : 'created'}`);
          setOpen(false);
        })
        .catch(error => {
          notification.error({
            message: error.error,
            description: error.message,
          });
        });
    },
    [setOpen, notification, message, model?._id, endpoint]
  );

  const [form] = Form.useForm();

  return (
    <Form layout="vertical" form={form} onFinish={handleFinish} initialValues={model}>
      <Form.Item name="name" label="Name" rules={[{ required: true, type: 'string' }]}>
        <Input placeholder="Enter name" />
      </Form.Item>
      <Row gutter={[16, 16]} align="middle" justify="space-between">
        <Col flex="auto">
          <Form.Item name="linkToFile" label="Link to file" rules={[{ required: false, type: 'string' }]}>
            <Input placeholder="Enter link to file" />
          </Form.Item>
        </Col>
        <Col>
          <Form.Item name="color" label="Color">
            <ColorPicker />
          </Form.Item>
        </Col>
      </Row>
      <MembersSelect multiple name="instructors" label="Instructors" rules={[{ required: false, type: 'array' }]} defaultValue={model?.instructors} />
      <SpecializationsSelect
        multiple
        name="requiredSpecializations"
        label="Required Specializations"
        rules={[{ required: false, type: 'array' }]}
        defaultValue={model?.requiredSpecializations}
      />
      <RanksSelect name="requiredRankId" label="Required Rank" rules={[{ required: false, type: 'string' }]} defaultValue={model?.requiredRankId} />
      <Form.Item name="description" label="Description" rules={[{ required: false, type: 'string' }]}>
        <Input.TextArea autoSize placeholder="Enter description" />
      </Form.Item>
      <FormFooter setOpen={setOpen} />
    </Form>
  );
};

export default SpecializationForm;
