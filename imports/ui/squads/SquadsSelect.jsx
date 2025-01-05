import React, { useCallback, useContext, useEffect, useState } from 'react';
import { App, Button, Col, Form, Row, Select, Tag } from 'antd';
import { Meteor } from 'meteor/meteor';
import { SubdrawerContext } from '../app/App';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import SquadsForm from './SquadsForm';

export default function SquadsSelect({ multiple, name, label, rules }) {
  const { modal } = App.useApp();
  const subdrawer = useContext(SubdrawerContext);

  const [squadOptions, setSquadOptions] = useState([]);
  const fetchOptions = useCallback(() => Meteor.callAsync('squads.options').then(res => setSquadOptions(res)), []);
  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  const handleEdit = useCallback(
    async (e, value) => {
      e.preventDefault();
      e.stopPropagation();
      const model = squadOptions.find(option => option.value === value)?.raw || {};
      subdrawer.setDrawerTitle('Edit Squad');
      subdrawer.setDrawerModel(model);
      subdrawer.setDrawerComponent(
        <SquadsForm
          setOpen={value => {
            subdrawer.setDrawerOpen(value);
            fetchOptions();
          }}
          useSubdrawer
        />
      );
      subdrawer.setDrawerOpen(true);
    },
    [subdrawer, squadOptions, fetchOptions]
  );

  const handleDelete = useCallback(
    async (e, value) => {
      e.preventDefault();
      e.stopPropagation();
      modal.confirm({
        title: 'Are you sure you want to delete this squad?',
        okText: 'Delete',
        okType: 'danger',
        closable: true,
        maskClosable: true,
        onOk: async () => {
          await Meteor.callAsync('squads.remove', value);
          fetchOptions();
        },
      });
    },
    [modal, fetchOptions]
  );

  const optionRender = useCallback(
    ({ label, value }) => {
      const match = squadOptions.find(option => option.value === value);
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
    [handleEdit, handleDelete, squadOptions]
  );

  return (
    <Form.Item name={name} label={label} rules={rules}>
      <Select
        placeholder="Select squads"
        mode={multiple ? 'multiple' : undefined}
        optionFilterProp="label"
        options={squadOptions}
        optionRender={optionRender}
        showSearch
      />
    </Form.Item>
  );
}
