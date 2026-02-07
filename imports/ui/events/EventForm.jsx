import { DeleteOutlined, SaveOutlined, TeamOutlined, UsergroupAddOutlined } from '@ant-design/icons';
import { App, Button, Col, ColorPicker, DatePicker, Form, Input, Row, Select, Switch } from 'antd';
import dayjs from 'dayjs';
import { Meteor } from 'meteor/meteor';
import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import PropTypes from 'prop-types';
import React, { useCallback, useContext, useMemo, useState } from 'react';
import EventTypesCollection from '../../api/collections/eventTypes.collection';
import SquadsCollection from '../../api/collections/squads.collection';
import { useTranslation } from '../../i18n/LanguageContext';
import { DrawerContext } from '../app/App';
import CollectionSelect from '../components/CollectionSelect';
import MembersSelect from '../members/MembersSelect';
import { getColorFromValues } from '../specializations/SpecializationForm';
import EventTypesForm from './event-types/EventTypesForm';

const styles = {
  datePicker: {
    width: '100%',
  },
};

export const getDateFromValues = (values, key = 'date') => {
  if (values[key]) return values[key].toDate();
  return values[key];
};

const EventForm = ({ setOpen }) => {
  const { message, notification, modal } = App.useApp();
  const { t } = useTranslation();
  const drawer = useContext(DrawerContext);

  const model = useMemo(() => {
    const data = drawer.drawerModel || {};
    return {
      ...data,
      start: data.start ? dayjs(data.start) : null,
      end: data.end ? dayjs(data.end) : null,
    };
  }, [drawer]);

  const handleFinish = useCallback(
    values => {
      values.color = getColorFromValues(values);
      values.start = getDateFromValues(values, 'start');
      values.end = getDateFromValues(values, 'end');
      const args = [...(model?._id ? [model._id] : []), values];
      const endpoint = model?._id ? 'events.update' : 'events.insert';
      const handleError = error => {
        notification.error({
          message: error.error,
          description: error.message,
        });
      };
      const handleSuccess = () => {
        const text = model?._id ? t('messages.eventUpdated') : t('messages.eventCreated');
        message.success(text);
        setOpen(false);
      };
      Meteor.callAsync(endpoint, ...args)
        .then(handleSuccess)
        .catch(handleError);
    },
    [model?._id, message, notification, setOpen, t]
  );

  const handleDelete = useCallback(() => {
    modal.confirm({
      title: t('forms.confirmations.deleteEvent'),
      okText: t('common.delete'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: async () => {
        await Meteor.callAsync('events.remove', model._id)
          .then(() => {
            message.success(t('messages.eventDeleted'));
            setOpen(false);
          })
          .catch(error => {
            notification.error({
              message: error.error,
              description: error.message,
            });
          });
      },
    });
  }, [modal, message, setOpen, model, notification, t]);

  const [form] = Form.useForm();

  return (
    <Form form={form} layout="vertical" initialValues={model} onFinish={handleFinish}>
      <Form.Item name="start" label={t('events.startDate')} rules={[{ required: true, type: 'date' }]}>
        <DatePicker style={styles.datePicker} showTime />
      </Form.Item>
      <Form.Item name="end" label={t('events.endDate')} rules={[{ required: true, type: 'date' }]}>
        <DatePicker style={styles.datePicker} showTime />
      </Form.Item>
      <Form.Item name="name" label={t('common.name')} rules={[{ required: true, type: 'string' }]}>
        <Input placeholder={t('forms.placeholders.enterTitle')} />
      </Form.Item>
      <CollectionSelect
        defaultValue={model.eventType}
        name="eventType"
        label={t('events.eventType')}
        placeholder={t('common.selectEventType')}
        rules={[{ type: 'string' }]}
        collection={EventTypesCollection}
        subscription="eventTypes"
        FormComponent={EventTypesForm}
      />
      <MembersSelect multiple name="hosts" label={t('events.hosts')} rules={[{ type: 'array' }]} defaultValue={model.hosts} />
      <MembersSelect multiple name="attendees" label={t('events.attendees')} rules={[{ type: 'array' }]} defaultValue={model.attendees} />
      <SquadQuickAdd form={form} t={t} />
      <Row gutter={[16, 16]} style={{ flexWrap: 'nowrap' }}>
        <Col flex="auto">
          <Form.Item name="isPrivate" label={t('forms.labels.isPrivate')} valuePropName="checked" rules={[{ type: 'boolean' }]}>
            <Switch />
          </Form.Item>
        </Col>
        <Col flex="auto">
          <Form.Item name="color" label={t('common.color')}>
            <ColorPicker placeholder={t('forms.placeholders.enterColor')} />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="preset" label={t('forms.labels.presetLink')} rules={[{ type: 'string' }]}>
        <Input placeholder={t('forms.placeholders.enterPresetLink')} />
      </Form.Item>
      <Form.Item name="description" label={t('common.description')} rules={[{ type: 'string' }]}>
        <Input.TextArea autoSize placeholder={t('forms.placeholders.enterDescription')} />
      </Form.Item>
      <Row gutter={[16, 16]} justify="end" align="middle">
        {model?._id && (
          <Col>
            <Button type="primary" onClick={handleDelete} icon={<DeleteOutlined />} danger>
              {t('common.delete')}
            </Button>
          </Col>
        )}
        <Col>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
            {t('common.save')}
          </Button>
        </Col>
      </Row>
    </Form>
  );
};
EventForm.propTypes = {
  setOpen: PropTypes.func,
};

const SquadQuickAdd = ({ form, t }) => {
  const [selectedSquad, setSelectedSquad] = useState(undefined);
  const [loading, setLoading] = useState(false);
  const { notification } = App.useApp();
  useSubscribe('squads', {}, {});
  const squads = useFind(() => SquadsCollection.find({}), []);
  const squadOptions = useMemo(() => squads.map(s => ({ label: s.name, value: s._id })), [squads]);

  const mergeAttendees = useCallback(
    newIds => {
      const current = form.getFieldValue('attendees') || [];
      const merged = [...new Set([...current, ...newIds])];
      form.setFieldsValue({ attendees: merged });
    },
    [form]
  );

  const handleAddSquad = useCallback(async () => {
    if (!selectedSquad) return;
    setLoading(true);
    try {
      const members = await Meteor.callAsync('members.read', { 'profile.squadId': selectedSquad }, { fields: { _id: 1 } });
      mergeAttendees(members.map(m => m._id));
    } catch (error) {
      notification.error({ message: error.error, description: error.message });
    }
    setLoading(false);
  }, [selectedSquad, mergeAttendees, notification]);

  const handleAddAll = useCallback(async () => {
    setLoading(true);
    try {
      const members = await Meteor.callAsync('members.read', {}, { fields: { _id: 1 } });
      mergeAttendees(members.map(m => m._id));
    } catch (error) {
      notification.error({ message: error.error, description: error.message });
    }
    setLoading(false);
  }, [mergeAttendees, notification]);

  return (
    <Row gutter={[8, 8]} style={{ marginBottom: 16 }} align="middle">
      <Col flex="auto">
        <Select
          style={{ width: '100%' }}
          placeholder={t('common.selectSquad')}
          value={selectedSquad}
          onChange={setSelectedSquad}
          options={squadOptions}
          allowClear
          showSearch
          optionFilterProp="label"
        />
      </Col>
      <Col>
        <Button icon={<TeamOutlined />} onClick={handleAddSquad} loading={loading} disabled={!selectedSquad}>
          {t('events.addSquad')}
        </Button>
      </Col>
      <Col>
        <Button icon={<UsergroupAddOutlined />} onClick={handleAddAll} loading={loading}>
          {t('events.addAll')}
        </Button>
      </Col>
    </Row>
  );
};
SquadQuickAdd.propTypes = {
  form: PropTypes.object,
  t: PropTypes.func,
};

export default EventForm;
