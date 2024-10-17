import { Alert, App, Button, Col, Divider, Form, Input, InputNumber, Row, Select, Upload } from 'antd';
import React from 'react';
import { Meteor } from 'meteor/meteor';
import { DrawerContext } from '../app/App';
import ProfilePictureInput from '../profile-picture-input/ProfilePictureInput';

export default function MemberForm({ setOpen }) {
  const [form] = Form.useForm();
  const { message, notification } = App.useApp();
  const [loading, setLoading] = React.useState(false);
  const [disableSubmit, setDisableSubmit] = React.useState(false);
  const [nameError, setNameError] = React.useState(undefined);
  const [idError, setIdError] = React.useState(undefined);
  const [fileList, setFileList] = React.useState([]);
  const drawer = React.useContext(DrawerContext);
  const model = React.useMemo(() => {
    return drawer.drawerModel || {};
  }, [drawer]);
  React.useEffect(() => {
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
  }, [model]);

  function validateName() {
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
  }

  function validateId() {
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
  }

  function handleSubmit(values) {
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
  }

  function handleValuesChange(changedValues, values) {
    if ('name' in values) {
      validateName();
    }
    if ('id' in values) {
      validateId();
    }
    if ('rulesReadAndAccepted' in changedValues && 'rulesReadAndAccepted' in values) {
      setDisableSubmit(!values.rulesReadAndAccepted);
    }
  }

  function handleCancel() {
    setOpen(false);
    form.resetFields();
    drawer.setDrawerModel({});
  }

  React.useEffect(() => {
    handleValuesChange(model ?? {}, model ?? {});
  }, [model]);

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
      <Form.Item name="rankId" label="Rank" rules={[{ type: 'string' }]}>
        <Select placeholder="Select rank" options={[]} />
      </Form.Item>
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
