import { App, Button, Col, Form, Row, Select, Tag } from 'antd';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { SubdrawerContext } from '../../app/App';
import RanksForm from './RanksForm';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';

const RanksSelect = ({ multiple, name, label, rules }) => {
  const { modal } = App.useApp();
  const subdrawer = useContext(SubdrawerContext);
  const [rankOptions, setRankOptions] = useState([]);
  useEffect(() => {
    Meteor.callAsync('ranks.options').then(res => setRankOptions(res));
  }, []);

  const handleEdit = useCallback(
    (e, value) => {
      e.preventDefault();
      e.stopPropagation();
      const model = rankOptions.find(option => option.value === value)?.raw || {};
      subdrawer.setDrawerTitle('Edit Rank');
      subdrawer.setDrawerModel(model);
      subdrawer.setDrawerComponent(<RanksForm setOpen={subdrawer.setDrawerOpen} useSubdrawer />);
      subdrawer.setDrawerOpen(true);
    },
    [subdrawer, rankOptions]
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
      const match = rankOptions.find(option => option.value === value)?.raw || {};
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
    [handleEdit, handleDelete, rankOptions]
  );

  return (
    <Form.Item name={name} label={label} rules={rules}>
      <Select
        placeholder="Select rank"
        options={rankOptions}
        optionRender={optionRender}
        optionFilterProp="label"
        mode={multiple ? 'multiple' : undefined}
        showSearch
      />
    </Form.Item>
  );
};

export default RanksSelect;
