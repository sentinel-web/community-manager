import { DeleteOutlined, SaveOutlined, TeamOutlined, UsergroupAddOutlined } from '@ant-design/icons';
import { App, Button, Col, ColorPicker, DatePicker, Form, Input, Row, Select, Switch } from 'antd';
import type { FormInstance } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import React, { useCallback, useContext, useMemo, useState } from 'react';
import EventTypesCollection from '../../api/collections/eventTypes.collection';
import SquadsCollection from '../../api/collections/squads.collection';
import type { EventDoc } from '../../api/types/event';
import type { CollectionDoc } from '../components/CollectionSelect';
import { useTranslation } from '../../i18n/LanguageContext';
import type { TranslateFn } from '../section/types';
import { DrawerContext } from '../app/App';
import type { DrawerContextValue } from '../app/types';
import CollectionSelect from '../components/CollectionSelect';
import MembersSelect from '../members/MembersSelect';
import { getColorFromValues } from '../specializations/SpecializationForm';
import EventTypesForm from './event-types/EventTypesForm';

const styles = {
  datePicker: {
    width: '100%',
  },
};

/** Form values — DatePicker yields Dayjs objects, not Date. */
interface EventFormValues {
  start: Dayjs | null;
  end: Dayjs | null;
  name: string;
  eventType?: string;
  hosts?: string[];
  attendees?: string[];
  isPrivate?: boolean;
  color?: unknown;
  preset?: string;
  description?: string;
}

export const getDateFromValues = (values: Record<string, unknown>, key = 'date'): Date | undefined => {
  const val = values[key];
  if (val && typeof (val as Dayjs).toDate === 'function') return (val as Dayjs).toDate();
  return val as Date | undefined;
};

interface EventFormProps {
  setOpen: (open: boolean) => void;
}

const EventForm = ({ setOpen }: EventFormProps) => {
  const { message, notification, modal } = App.useApp();
  const { t } = useTranslation();
  const drawer = useContext(DrawerContext) as DrawerContextValue;

  const model = useMemo(() => {
    const data = (drawer.drawerModel || {}) as unknown as EventDoc;
    return {
      ...data,
      start: data.start ? dayjs(data.start) : null,
      end: data.end ? dayjs(data.end) : null,
      hosts: data.hosts || (data._id ? [] : [Meteor.userId()]),
    } as EventFormValues & { _id?: string };
  }, [drawer]);

  const handleFinish = useCallback(
    (values: EventFormValues) => {
      const wireValues = {
        ...values,
        color: getColorFromValues(values as unknown as Record<string, unknown>),
        start: getDateFromValues(values as unknown as Record<string, unknown>, 'start'),
        end: getDateFromValues(values as unknown as Record<string, unknown>, 'end'),
      };
      const args = [...(model?._id ? [model._id] : []), wireValues];
      const endpoint = model?._id ? 'events.update' : 'events.insert';
      const handleError = (error: Meteor.Error) => {
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
          .catch((error: Meteor.Error) => {
            notification.error({
              message: error.error,
              description: error.message,
            });
          });
      },
    });
  }, [modal, message, setOpen, model, notification, t]);

  const [form] = Form.useForm<EventFormValues>();

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
        collection={EventTypesCollection as unknown as Mongo.Collection<CollectionDoc>}
        subscription="eventTypes"
        FormComponent={EventTypesForm}
      />
      <MembersSelect multiple grouped name="hosts" label={t('events.hosts')} rules={[{ type: 'array' }]} defaultValue={model.hosts} />
      <MembersSelect multiple grouped name="attendees" label={t('events.attendees')} rules={[{ type: 'array' }]} defaultValue={model.attendees} />
      <SquadQuickAdd form={form} t={t} />
      <Row gutter={[16, 16]} style={{ flexWrap: 'nowrap' }}>
        <Col flex="auto">
          <Form.Item name="isPrivate" label={t('forms.labels.isPrivate')} valuePropName="checked" rules={[{ type: 'boolean' }]}>
            <Switch />
          </Form.Item>
        </Col>
        <Col flex="auto">
          <Form.Item name="color" label={t('common.color')}>
            <ColorPicker />
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

interface SquadQuickAddProps {
  form: FormInstance<EventFormValues>;
  t: TranslateFn;
}

const SquadQuickAdd = ({ form, t }: SquadQuickAddProps) => {
  const [selectedSquad, setSelectedSquad] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const { notification } = App.useApp();
  useSubscribe('squads', {}, {});
  const squads = useFind(() => SquadsCollection.find({}), []);
  const squadOptions = useMemo(() => squads.map(s => ({ label: s.name, value: s._id })), [squads]);

  const mergeAttendees = useCallback(
    (newIds: string[]) => {
      const current: string[] = form.getFieldValue('attendees') || [];
      const merged = [...new Set([...current, ...newIds])];
      form.setFieldsValue({ attendees: merged });
    },
    [form]
  );

  const handleAddSquad = useCallback(async () => {
    if (!selectedSquad) return;
    setLoading(true);
    try {
      const members = (await Meteor.callAsync('members.read', { 'profile.squadId': selectedSquad }, { fields: { _id: 1 } })) as Array<{
        _id: string;
      }>;
      mergeAttendees(members.map(m => m._id));
    } catch (error) {
      notification.error({ message: (error as Meteor.Error).error, description: (error as Meteor.Error).message });
    }
    setLoading(false);
  }, [selectedSquad, mergeAttendees, notification]);

  const handleAddAll = useCallback(async () => {
    setLoading(true);
    try {
      const members = (await Meteor.callAsync('members.read', {}, { fields: { _id: 1 } })) as Array<{ _id: string }>;
      mergeAttendees(members.map(m => m._id));
    } catch (error) {
      notification.error({ message: (error as Meteor.Error).error, description: (error as Meteor.Error).message });
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

export default EventForm;
