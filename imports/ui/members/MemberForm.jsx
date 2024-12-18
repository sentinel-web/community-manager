import { Alert, App, Button, Col, Divider, Form, Input, InputNumber, Row, Select, Tag } from 'antd';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { DrawerContext, SubdrawerContext } from '../app/App';
import ProfilePictureInput from '../profile-picture-input/ProfilePictureInput';
import useRanks from './ranks/ranks.hook';
import RanksCollection from '../../api/collections/ranks.collection';
import RanksForm from './ranks/RanksForm';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';

const empty = <></>;

export default function MemberForm({ setOpen }) {
  const [form] = Form.useForm();
  const { message, notification, modal } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [disableSubmit, setDisableSubmit] = useState(false);
  const [nameError, setNameError] = useState(undefined);
  const [idError, setIdError] = useState(undefined);
  const [fileList, setFileList] = useState([]);
  const drawer = useContext(DrawerContext);
  const subdrawer = useContext(SubdrawerContext);
  const model = useMemo(() => {
    return drawer.drawerModel || {};
  }, [drawer]);
  useEffect(() => {
    if (Object.keys(model).length > 0) {
      form.setFieldsValue(model);
    } else {
      form.setFieldsValue({
        profilePictureId: '',
        username: '',
        password: '',
        name: '',
        id: null,
        rankId: null,
        specializationIds: [],
        roleId: null,
        squadId: null,
        discordTag: '',
        steamProfileLink: '',
        description: '',
      });
      setFileList([]);
    }
  }, [model, form.setFieldsValue]);

  const validateName = useCallback(() => {
    const value = form.getFieldValue('name');
    setNameError('validating');
    Meteor.callAsync('registrations.validateName', value, model?._id)
      .then(result => {
        setNameError(result ? 'success' : 'error');
        setDisableSubmit(!result);
      })
      .catch(error => {
        setNameError('warning');
      });
  }, [form, model?._id]);

  const validateId = useCallback(() => {
    const value = form.getFieldValue('id');
    setIdError('validating');
    Meteor.callAsync('registrations.validateId', value, model?._id)
      .then(result => {
        setIdError(result ? 'success' : 'error');
        setDisableSubmit(!result);
      })
      .catch(error => {
        setIdError('warning');
      });
  }, [form, model?._id]);

  const handleSubmit = useCallback(
    values => {
      setLoading(true);
      const args = model?._id ? [model._id, values] : [values];
      Meteor.callAsync(Meteor.user() && model?._id ? 'members.update' : 'members.insert', ...args)
        .then(() => {
          setOpen(false);
          form.resetFields();
          message.success('Save successful');
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
    [form, model?._id, setOpen, message, notification]
  );

  const handleValuesChange = useCallback(
    (changedValues, values) => {
      if ('name' in values) {
        validateName();
      }
      if ('id' in values) {
        validateId();
      }
      if ('rulesReadAndAccepted' in changedValues && 'rulesReadAndAccepted' in values) {
        setDisableSubmit(!values.rulesReadAndAccepted);
      }
    },
    [validateName, validateId]
  );

  const handleCancel = useCallback(() => {
    setOpen(false);
    form.resetFields();
    drawer.setDrawerModel({});
  }, [setOpen, form, drawer]);

  useEffect(() => {
    handleValuesChange(model ?? {}, model ?? {});
  }, [model, handleValuesChange]);

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

  const handleCreate = useCallback(() => {
    subdrawer.setDrawerTitle('Create Rank');
    subdrawer.setDrawerModel({});
    subdrawer.setDrawerComponent(<RanksForm setOpen={subdrawer.setDrawerOpen} useSubdrawer />);
    subdrawer.setDrawerExtra(empty);
    subdrawer.setDrawerOpen(true);
  }, [subdrawer]);

  return (
    <Form autoComplete="off" form={form} layout="vertical" onFinish={handleSubmit} onValuesChange={handleValuesChange} disabled={loading}>
      <Form.Item name="profilePictureId" hidden />
      <Row justify="center" align="middle">
        <Col span={24}>
          <ProfilePictureInput fileList={fileList} setFileList={setFileList} form={form} profilePictureId={model?.profilePictureId} />
        </Col>
      </Row>
      <Divider>Member Account</Divider>
      <Form.Item name="username" label="Username" rules={[{ required: true, type: 'string' }]} required>
        <Input placeholder="Enter username" />
      </Form.Item>
      {!model?._id && (
        <Form.Item name="password" label="Password" rules={[{ required: true, type: 'string' }]} required>
          <Input.Password placeholder="Enter password" />
        </Form.Item>
      )}
      <Divider>Member Profile</Divider>
      {(nameError === 'error' || idError === 'error') && (
        <Alert
          className="alert"
          type="error"
          description={
            <Row gutter={[16, 16]}>
              {nameError === 'error' && <Col span={24}>Name already in use</Col>}
              {idError === 'error' && <Col span={24}>ID already in use</Col>}
            </Row>
          }
        />
      )}
      <Form.Item name="name" label="Name" rules={[{ required: true, type: 'string' }]} status={nameError} required>
        <Input placeholder="Enter name" />
      </Form.Item>
      <Form.Item
        name="id"
        label="ID"
        rules={[
          { required: true, type: 'number' },
          { min: 1000, max: 9999, type: 'number' },
        ]}
        status={idError}
        required
      >
        <InputNumber min={1000} max={9999} step={1} placeholder="Enter ID" />
      </Form.Item>
      <Row gutter={8} justify="space-between" align="middle">
        <Col flex="auto">
          <Form.Item name="rankId" label="Rank" rules={[{ type: 'string' }]}>
            <Select
              placeholder="Select rank"
              options={rankOptions}
              optionRender={optionRender}
              optionFilterProp="label"
              loading={!ready}
              showSearch
            />
          </Form.Item>
        </Col>
        <Col>
          <Button icon={<PlusOutlined />} onClick={handleCreate} style={{ marginTop: 8 }} />
        </Col>
      </Row>
      <Form.Item name="specializationIds" label="Specializations" rules={[{ type: 'array' }]}>
        <Select mode="multiple" placeholder="Select specializations" options={[]} />
      </Form.Item>
      <Form.Item name="roleId" label="Role" rules={[{ type: 'string' }]}>
        <Select placeholder="Select role" options={[]} />
      </Form.Item>
      <Form.Item name="squadId" label="Squad" rules={[{ type: 'string' }]}>
        <Select placeholder="Select squad" options={[]} />
      </Form.Item>
      <Form.Item name="discordTag" label="Discord Tag" rules={[{ type: 'string' }]}>
        <Input placeholder="Enter discord tag" />
      </Form.Item>
      <Form.Item name="steamProfileLink" label="Steam Profile Link" rules={[{ type: 'url' }]}>
        <Input placeholder="Enter steam profile link" />
      </Form.Item>
      {Meteor.user() && (
        <Form.Item name="description" label="Description" rules={[{ type: 'string' }]}>
          <Input.TextArea placeholder="Enter description" />
        </Form.Item>
      )}
      <Row gutter={[16, 16]} align="middle" justify="end">
        <Col>
          <Button onClick={handleCancel} danger>
            Cancel
          </Button>
        </Col>
        <Col>
          <Button type="primary" htmlType="submit" loading={loading} disabled={disableSubmit}>
            Submit
          </Button>
        </Col>
      </Row>
    </Form>
  );
}
