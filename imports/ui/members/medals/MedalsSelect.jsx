import React, { useCallback, useContext, useEffect, useState } from 'react';
import { App, Button, Col, Form, Row, Select, Tag } from 'antd';
import { Meteor } from 'meteor/meteor';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { SubdrawerContext } from '../../app/App';
import { getLegibleTextColor } from '../../../helpers/color.helper';
import useMedals from './medals.hook';
import MedalsForm from './MedalsForm';

export default function MedalsSelect({ multiple, name, label, rules }) {
  const { modal } = App.useApp();
  const subdrawer = useContext(SubdrawerContext);

  const { ready, medals } = useMedals();

  const [medalOptions, setMedalOptions] = useState([]);
  const fetchOptions = useCallback(() => Meteor.callAsync('medals.options').then(res => setMedalOptions(res)), []);
  useEffect(() => {
    if (!medals?.length) return;
    fetchOptions();
  }, [fetchOptions, medals]);

  const handleEdit = useCallback(
    async (e, value) => {
      e.preventDefault();
      e.stopPropagation();
      const model = medalOptions.find(option => option.value === value)?.raw || {};
      subdrawer.setDrawerTitle('Edit Medal');
      subdrawer.setDrawerModel(model);
      subdrawer.setDrawerComponent(
        <MedalsForm
          setOpen={value => {
            subdrawer.setDrawerOpen(value);
            fetchOptions();
          }}
          useSubdrawer
        />
      );
      subdrawer.setDrawerOpen(true);
    },
    [subdrawer, medalOptions, fetchOptions]
  );

  const handleDelete = useCallback(
    async (e, value) => {
      e.preventDefault();
      e.stopPropagation();
      modal.confirm({
        title: 'Are you sure you want to delete this medal?',
        okText: 'Delete',
        okType: 'danger',
        closable: true,
        maskClosable: true,
        onOk: async () => {
          await Meteor.callAsync('medals.remove', value);
          fetchOptions();
        },
      });
    },
    [modal, fetchOptions]
  );

  const optionRender = useCallback(
    ({ label, value }) => {
      const match = medalOptions.find(option => option.value === value);
      return (
        <Row gutter={[8, 8]} align="middle" justify="space-between" key={value}>
          <Col flex="auto">
            <Tag color={match?.raw?.color}>
              <span style={{ color: match?.raw?.color ? getLegibleTextColor(match?.raw?.color) : undefined }}>{label}</span>
            </Tag>
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
    [handleEdit, handleDelete, medalOptions]
  );

  const handleCreate = useCallback(() => {
    subdrawer.setDrawerTitle('Create Medal');
    subdrawer.setDrawerModel({});
    subdrawer.setDrawerComponent(
      <MedalsForm
        setOpen={value => {
          subdrawer.setDrawerOpen(value);
          fetchOptions();
        }}
        useSubdrawer
      />
    );
    subdrawer.setDrawerOpen(true);
  }, [subdrawer, fetchOptions]);

  return (
    <Row gutter={[8, 8]} align="middle">
      <Col flex="auto">
        <Form.Item name={name} label={label} rules={rules}>
          <Select
            loading={!ready}
            placeholder="Select medals"
            mode={multiple ? 'multiple' : undefined}
            optionFilterProp="label"
            options={medalOptions}
            optionRender={optionRender}
            allowClear
            showSearch
          />
        </Form.Item>
      </Col>
      <Col>
        <Button style={{ marginTop: 8 }} icon={<PlusOutlined />} onClick={handleCreate} />
      </Col>
    </Row>
  );
}
