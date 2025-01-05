import { App, Button, Col, ColorPicker, Form, Input, Row, Select, Tag } from 'antd';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { DrawerContext, SubdrawerContext } from '../../app/App';
import RanksCollection from '../../../api/collections/ranks.collection';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import useRanks from './ranks.hook';
import { getColorFromValues } from '../../specializations/SpecializationForm';

export default function RanksForm({ setOpen, useSubdrawer }) {
  const [form] = Form.useForm();
  const { message, notification, modal } = App.useApp();
  const subdrawer = useContext(SubdrawerContext);
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
      const { name, description } = values;
      const args = [...(model?._id ? [model._id] : []), { name, color: getColorFromValues(values), description }];
      Meteor.callAsync(Meteor.user() && model?._id ? 'ranks.update' : 'ranks.insert', ...args)
        .then(() => {
          setOpen(false);
          form.resetFields();
          message.success(`Rank ${model?._id ? 'updated' : 'created'} successfully`);
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

  const { ready, ranks } = useRanks();
  const rankOptions = useMemo(() => {
    return ready ? ranks.map(rank => ({ label: rank.name, value: rank._id, title: rank.description })) : [];
  }, [ready, ranks]);

  const handleEdit = useCallback(
    async (e, value) => {
      e.preventDefault();
      e.stopPropagation();
      const model = await RanksCollection.findOneAsync(value);
      subdrawer.setDrawerTitle('Edit Rank');
      subdrawer.setDrawerModel(model);
      subdrawer.setDrawerComponent(<RanksForm setOpen={subdrawer.setDrawerOpen} useSubdrawer />);
      subdrawer.setDrawerOpen(true);
    },
    [subdrawer]
  );

  const handleDelete = useCallback(
    async (e, value) => {
      e.preventDefault();
      e.stopPropagation();
      modal.confirm({
        title: 'Are you sure you want to delete this rank?',
        okText: 'Delete',
        onOk: async () => {
          await Meteor.callAsync('ranks.remove', value);
        },
      });
    },
    [modal]
  );

  const optionRender = useCallback(
    ({ label, value }) => {
      const match = RanksCollection.findOne(value);
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
      <Form.Item name="previousRankId" label="Previous Rank">
        <Select placeholder="Select rank" options={rankOptions} optionRender={optionRender} optionFilterProp="label" loading={!ready} showSearch />
      </Form.Item>
      <Form.Item name="nextRankId" label="Next Rank">
        <Select placeholder="Select rank" options={rankOptions} optionRender={optionRender} optionFilterProp="label" loading={!ready} showSearch />
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
