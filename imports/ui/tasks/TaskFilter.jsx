import { App, Form, Select } from 'antd';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useCallback, useContext, useMemo } from 'react';
import TaskStatusCollection from '../../api/collections/taskStatus.collection';
import { useTranslation } from '../../i18n/LanguageContext';
import { DrawerContext } from '../app/App';
import CollectionSelect from '../components/CollectionSelect';
import FormFooter from '../components/FormFooter';
import MembersSelect from '../members/MembersSelect';
import TaskStatusForm from './task-status/TaskStatusForm';

const TaskFilter = ({ setOpen }) => {
  const { t } = useTranslation();
  const { drawerModel: model } = useContext(DrawerContext);
  const { notification } = App.useApp();
  const [form] = Form.useForm();

  const handleFinish = useCallback(
    async values => {
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
        collection={TaskStatusCollection}
        mode="multiple"
        subscription="taskStatus"
      />
      <MembersSelect
        name="participants"
        label={t('tasks.participants')}
        rules={[{ required: false, type: 'array' }]}
        placeholder={t('forms.placeholders.selectParticipants')}
        defaultValue={model?.participants}
        multiple
      />
      <FormFooter setOpen={setOpen} />
    </Form>
  );
};
TaskFilter.propTypes = {
  setOpen: PropTypes.func,
};

export default TaskFilter;
