import { Alert, App, Button, Col, DatePicker, Divider, Form, Input, InputNumber, Row, Switch } from 'antd';
import dayjs from 'dayjs';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import RanksCollection from '../../api/collections/ranks.collection';
import RolesCollection from '../../api/collections/roles.collection';
import { DrawerContext } from '../app/App';
import CollectionSelect from '../components/CollectionSelect';
import { getDateFromValues } from '../events/EventForm';
import ProfilePictureInput from '../profile-picture-input/ProfilePictureInput';
import SpecializationsSelect from '../specializations/SpecializationsSelect';
import SquadsSelect from '../squads/SquadsSelect';
import MedalsSelect from './medals/MedalsSelect';
import RanksForm from './ranks/RanksForm';
import RolesForm from './roles/RolesForm';

const styles = {
  datePicker: {
    width: '100%',
  },
};

export const transformDateToDays = (values, key = 'date') => {
  if (values[key]) return dayjs(values[key]);
  return values[key];
};

export default function MemberForm({ setOpen }) {
  const [form] = Form.useForm();
  const { message, notification } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [disableSubmit, setDisableSubmit] = useState(false);
  const [nameError, setNameError] = useState(undefined);
  const [idError, setIdError] = useState(undefined);
  const [fileList, setFileList] = useState([]);
  const drawer = useContext(DrawerContext);
  const model = useMemo(() => {
    return drawer.drawerModel || {};
  }, [drawer]);
  useEffect(() => {
    if (Object.keys(model).length > 0) {
      const data = { ...model };
      data.profile.entryDate = transformDateToDays(data.profile, 'entryDate');
      data.profile.exitDate = transformDateToDays(data.profile, 'exitDate');
      form.setFieldsValue(data);
    } else {
      form.setFieldsValue({
        username: '',
        password: '',
        profile: {
          profilePictureId: '',
          name: '',
          id: null,
          rankId: null,
          navyRankId: null,
          specializationIds: [],
          roleId: null,
          squadId: null,
          discordTag: '',
          steamProfileLink: '',
          staticAttendancePoints: null,
          staticInactivityPoints: null,
          medalIds: [],
          description: '',
          entryDate: null,
          exitDate: null,
        },
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
        console.error(error);
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
        console.error(error);
        setIdError('warning');
      });
  }, [form, model?._id]);

  const handleSubmit = useCallback(
    values => {
      setLoading(true);
      const payload = {
        ...values,
        profile: {
          ...values.profile,
          entryDate: getDateFromValues(values.profile, 'entryDate'),
          exitDate: getDateFromValues(values.profile, 'exitDate'),
        },
      };
      const args = model?._id ? [model._id, payload] : [payload];
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

  return (
    <Form autoComplete="off" form={form} layout="vertical" onFinish={handleSubmit} onValuesChange={handleValuesChange} disabled={loading}>
      <Form.Item name={['profile', 'profilePictureId']} hidden />
      <Row justify="center" align="middle">
        <Col span={24}>
          <ProfilePictureInput fileList={fileList} setFileList={setFileList} form={form} profilePictureId={model?.profile?.profilePictureId} />
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
      <Form.Item
        name={['profile', 'id']}
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
      <Form.Item name={['profile', 'name']} label="Name" rules={[{ required: true, type: 'string' }]} status={nameError} required>
        <Input placeholder="Enter name" />
      </Form.Item>
      <SquadsSelect name={['profile', 'squadId']} label="Squad" rules={[{ type: 'string' }]} defaultValue={model?.profile?.squadId} />
      <CollectionSelect
        defaultValue={model?.profile?.rankId}
        FormComponent={RanksForm}
        name={['profile', 'rankId']}
        label="Rank"
        rules={[{ type: 'string' }]}
        collection={RanksCollection}
        subscription="ranks"
      />
      <CollectionSelect
        defaultValue={model?.profile?.navyRankId}
        FormComponent={RanksForm}
        name={['profile', 'navyRankId']}
        label="Navy Rank"
        rules={[{ type: 'string' }]}
        collection={RanksCollection}
        subscription="ranks"
      />
      {Meteor.user() && (
        <Form.Item name={['profile', 'description']} label="Description" rules={[{ type: 'string' }]}>
          <Input.TextArea autoSize placeholder="Enter description" />
        </Form.Item>
      )}
      <Divider>Admin Data</Divider>
      <SpecializationsSelect
        name={['profile', 'specializationIds']}
        label="Specializations"
        rules={[{ type: 'array' }]}
        defaultValue={model?.profile?.specializationIds}
        multiple
      />
      <MedalsSelect name={['profile', 'medalIds']} label="Medals" rules={[{ type: 'array' }]} defaultValue={model?.profile?.medalIds} multiple />
      <CollectionSelect
        name={['profile', 'roleId']}
        label="Role"
        placeholder="Select role"
        rules={[{ type: 'string' }]}
        subscription="roles"
        FormComponent={RolesForm}
        defaultValue={model?.profile?.roleId}
        collection={RolesCollection}
      />
      <Form.Item name={['profile', 'discordTag']} label="Discord Tag" rules={[{ type: 'string' }]}>
        <Input placeholder="Enter discord tag" />
      </Form.Item>
      <Form.Item name={['profile', 'steamProfileLink']} label="Steam Profile Link" rules={[{ type: 'url' }]}>
        <Input placeholder="Enter steam profile link" />
      </Form.Item>
      <Form.Item name={['profile', 'staticAttendancePoints']} label="Static Attendance Points" rules={[{ type: 'number' }]}>
        <InputNumber min={0} placeholder="Enter static attendance points" />
      </Form.Item>
      <Form.Item name={['profile', 'staticInactivityPoints']} label="Static Inactivity Points" rules={[{ type: 'number' }]}>
        <InputNumber min={0} placeholder="Enter static inactivity points" />
      </Form.Item>
      <Form.Item name={['profile', 'entryDate']} label="Entry Date" rules={[{ type: 'date' }]}>
        <DatePicker style={styles.datePicker} />
      </Form.Item>
      <Form.Item name={['profile', 'exitDate']} label="Exit Date" rules={[{ type: 'date' }]}>
        <DatePicker style={styles.datePicker} />
      </Form.Item>
      <Form.Item name={['profile', 'hasCustomArmour']} label="Has Custom Armour" valuePropName="checked" rules={[{ type: 'boolean' }]}>
        <Switch />
      </Form.Item>
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
MemberForm.propTypes = {
  setOpen: PropTypes.func,
};
