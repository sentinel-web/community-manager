import { App, Form, Select } from 'antd';
import { Mongo } from 'meteor/mongo';
import { Meteor } from 'meteor/meteor';
import React, { useCallback, useContext, useMemo } from 'react';
import TaskStatusCollection from '../../api/collections/taskStatus.collection';
import { useTranslation } from '../../i18n/LanguageContext';
import { DrawerContext } from '../app/App';
import type { DrawerContextValue } from '../app/types';
import CollectionSelect from '../components/CollectionSelect';
import FormFooter from '../components/FormFooter';
import MembersSelectJs from '../members/MembersSelect';
import TaskStatusForm from './task-status/TaskStatusForm';
import type { TaskFilterModel } from './types';

// MembersSelect is a JS component — cast to allow flexible prop passing from TSX
const MembersSelect = MembersSelectJs as unknown as React.ComponentType<Record<string, unknown>>;

interface TaskFilterProps {
  setOpen: (open: boolean) => void;
}

export default function TaskFilter({ setOpen }: TaskFilterProps) {
  const { t } = useTranslation();
  const { drawerModel } = useContext(DrawerContext) as DrawerContextValue;
  const model = drawerModel as unknown as TaskFilterModel;
  const { notification } = App.useApp();
  const [form] = Form.useForm();

  const handleFinish = useCallback(
    async (values: TaskFilterModel) => {
      Meteor.callAsync('members.saveTaskFilter', values)
        .then(() => {
          setOpen(false);
        })
        .catch(error => {
          notification.error({
            message: error.error,
            description: error.message,
          });
        });
    },
    [setOpen, notification]
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
        collection={TaskStatusCollection as unknown as Mongo.Collection<{ _id?: string; name?: string; color?: string; [key: string]: unknown }>}
        mode="multiple"
        subscription="taskStatus"
      />
      <MembersSelect
        name="participants"
        label={t('tasks.participants')}
        rules={[{ required: false, type: 'array' }]}
        defaultValue={model?.participants}
        multiple
      />
      <FormFooter setOpen={setOpen} />
    </Form>
  );
}
