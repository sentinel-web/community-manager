import { App, Button, Col, Form, Row, Select, Tag } from 'antd';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { SubdrawerContext } from '../../app/App';
import EventTypesForm from './EventTypesForm';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';

const EventTypesSelect = ({ multiple, name, label, rules }) => {
  const { modal } = App.useApp();
  const subdrawer = useContext(SubdrawerContext);
  const [eventTypesOptions, setEventTypesOptions] = useState([]);
  useEffect(() => {
    Meteor.callAsync('eventTypes.options').then(res => setEventTypesOptions(res));
  }, []);

  const handleEdit = useCallback(
    (e, value) => {
      e.preventDefault();
      e.stopPropagation();
      const model = eventTypesOptions.find(option => option.value === value)?.raw || {};
      subdrawer.setDrawerTitle('Edit Event Type');
      subdrawer.setDrawerModel(model);
      subdrawer.setDrawerComponent(<EventTypesForm setOpen={subdrawer.setDrawerOpen} useSubdrawer />);
      subdrawer.setDrawerOpen(true);
    },
    [subdrawer, eventTypesOptions]
  );

  const handleDelete = useCallback(
    async (e, value) => {
      e.preventDefault();
      e.stopPropagation();
      modal.confirm({
        title: 'Are you sure you want to delete this event type?',
        okText: 'Delete',
        onOk: async () => {
          await Meteor.callAsync('eventTypes.remove', value);
        },
      });
    },
    [modal]
  );

  const optionRender = useCallback(
    ({ label, value }) => {
      const match = eventTypesOptions.find(option => option.value === value)?.raw || {};
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
    [handleEdit, handleDelete, eventTypesOptions]
  );

  return (
    <Form.Item name={name} label={label} rules={rules}>
      <Select
        placeholder="Select event type"
        options={eventTypesOptions}
        optionRender={optionRender}
        optionFilterProp="label"
        mode={multiple ? 'multiple' : undefined}
        showSearch
      />
    </Form.Item>
  );
};

export default EventTypesSelect;
