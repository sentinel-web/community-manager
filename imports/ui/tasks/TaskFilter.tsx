import { App, Form, Select } from 'antd';
import { Mongo } from 'meteor/mongo';
import { Meteor } from 'meteor/meteor';
import React, { useCallback, useMemo } from 'react';
import TaskStatusCollection from '../../api/collections/taskStatus.collection';
import { useTranslation } from '../../i18n/LanguageContext';
import { useDrawerFrame } from '../drawer-stack';
import CollectionSelect, { type CollectionDoc } from '../components/CollectionSelect';
import FormFooter from '../components/FormFooter';
import MembersSelectJs from '../members/MembersSelect';
import TaskStatusForm from './task-status/TaskStatusForm';
import type { TaskFilterModel } from './types';

const MembersSelect = MembersSelectJs as unknown as React.ComponentType<Record<string, unknown>>;

export default function TaskFilter() {
  const { t } = useTranslation();
  const { model, resolve, cancel } = useDrawerFrame<void, TaskFilterModel | undefined>();
  const { notification } = App.useApp();
  const [form] = Form.useForm();

  const handleFinish = useCallback(
    async (values: TaskFilterModel) => {
      try {
        await Meteor.callAsync('members.saveTaskFilter', values);
        resolve(undefined);
      } catch (error) {
        const err = error as Meteor.Error;
        notification.error({
          message: err.error as string,
          description: err.message,
        });
      }
    },
    [resolve, notification]
  );

  const typeOptions = useMemo(
    () => [
      { value: 'table', label: t('tasks.viewTable') },
      { value: 'kanban', label: t('tasks.viewKanban') },
    ],
    [t]
  );

  return (
    <Form layout="vertical" form={form} onFinish={handleFinish} initialValues={model || { type: 'table', status: [], participants: [] }}>
      <Form.Item label={t('tasks.type')} name="type" rules={[{ required: false, type: 'string' }]}>
        <Select placeholder={t('tasks.selectType')} allowClear options={typeOptions} />
      </Form.Item>
      <CollectionSelect
        defaultValue={model?.status}
        name="status"
        label={t('common.status')}
        rules={[{ required: false, type: 'array' }]}
        placeholder={t('common.status')}
        FormComponent={TaskStatusForm}
        collection={TaskStatusCollection as unknown as Mongo.Collection<CollectionDoc>}
        mode="multiple"
        subscription="taskStatus"
        useDrawerStack
      />
      <MembersSelect
        name="participants"
        label={t('tasks.participants')}
        rules={[{ required: false, type: 'array' }]}
        defaultValue={model?.participants}
        multiple
      />
      <FormFooter onCancel={cancel} />
    </Form>
  );
}
