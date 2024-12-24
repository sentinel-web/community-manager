import React, { useCallback, useContext, useEffect, useState } from 'react';
import { App, Button, Col, Form, Row, Select, Tag } from 'antd';
import { Meteor } from 'meteor/meteor';
import { SubdrawerContext } from '../app/App';
import SpecializationForm from './SpecializationForm';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';

export default function SpecializationsSelect({ multiple, name, label, rules }) {
  const { modal } = App.useApp();
  const subdrawer = useContext(SubdrawerContext);

  const [specializationOptions, setSpecializationOptions] = useState([]);
  const fetchOptions = useCallback(() => Meteor.callAsync('specializations.options').then(res => setSpecializationOptions(res)), []);
  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  const handleEdit = useCallback(
    async (e, value) => {
      e.preventDefault();
      e.stopPropagation();
      const model = specializationOptions.find(option => option.value === value)?.raw || {};
      subdrawer.setDrawerTitle('Edit Specialization');
      subdrawer.setDrawerModel(model);
      subdrawer.setDrawerComponent(
        <SpecializationForm
          setOpen={value => {
            subdrawer.setDrawerOpen(value);
            fetchOptions();
          }}
          useSubdrawer
        />
      );
      subdrawer.setDrawerOpen(true);
    },
    [subdrawer, specializationOptions, fetchOptions]
  );

  const handleDelete = useCallback(
    async (e, value) => {
      e.preventDefault();
      e.stopPropagation();
      modal.confirm({
        title: 'Are you sure you want to delete this specialization?',
        okText: 'Delete',
        okType: 'danger',
        closable: true,
        maskClosable: true,
        onOk: async () => {
          await Meteor.callAsync('specializations.remove', value);
        },
      });
    },
    [modal]
  );

  const optionRender = useCallback(
    ({ label, value }) => {
      const match = specializationOptions.find(option => option.value === value);
      return (
        <Row gutter={[8, 8]} align="middle" justify="space-between" key={value}>
          <Col flex="auto">
            <Tag color={match?.raw?.color}>{label}</Tag>
          </Col>
          <Col>
            <Button icon={<EditOutlined />} onClick={e => handleEdit(e, value)} type="text" size="small" />
          </Col>
          <Col>
            <Button icon={<DeleteOutlined />} onClick={e => handleDelete(e, value)} style={{ marginRight: 8 }} type="text" size="small" danger />
          </Col>
        </Row>
      );
    },
    [handleEdit, handleDelete, specializationOptions]
  );

  return (
    <Form.Item name={name} label={label} rules={rules}>
      <Select
        placeholder="Select specializations"
        mode={multiple ? 'multiple' : undefined}
        optionFilterProp="label"
        options={specializationOptions}
        optionRender={optionRender}
        showSearch
      />
    </Form.Item>
  );
}
