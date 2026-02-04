import { App, Form, Input, Select } from 'antd';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import TasksCollection from '../../api/collections/tasks.collection';
import TaskStatusCollection from '../../api/collections/taskStatus.collection';
import { useTranslation } from '../../i18n/LanguageContext';
import { DrawerContext } from '../app/App';
import CollectionSelect from '../components/CollectionSelect';
import FormFooter from '../components/FormFooter';
import TaskStatusForm from './task-status/TaskStatusForm';

const TaskForm = ({ setOpen }) => {
  const { drawerModel: model } = useContext(DrawerContext);
  const { message, notification } = App.useApp();
  const { t } = useTranslation();
  const { isUpdate, endpoint } = useMemo(
    () => (model?._id ? { isUpdate: true, endpoint: 'tasks.update' } : { isUpdate: false, endpoint: 'tasks.insert' }),
    [model?._id]
  );

  const handleFinish = useCallback(
    async values => {
      try {
        const args = isUpdate ? [model._id, values] : [values];
        await Meteor.callAsync(endpoint, ...args);
        setOpen(false);
        message.success(isUpdate ? t('messages.taskUpdated') : t('messages.taskCreated'));
      } catch (error) {
        notification.error({
          message: error.error,
          description: error.message,
        });
      }
    },
    [setOpen, endpoint, model?._id, isUpdate, message, notification, t]
  );

  const [participantOptions, setParticipantOptions] = useState([]);
  useEffect(() => {
    Meteor.callAsync('members.options')
      .then(res => setParticipantOptions(res))
      .catch(() => {});
  }, []);

  const [form] = Form.useForm();

  return (
    <Form layout="vertical" form={form} onFinish={handleFinish} initialValues={model}>
      <Form.Item label={t('common.name')} name="name" rules={[{ required: true, type: 'string' }]} required>
        <Input placeholder={t('forms.placeholders.enterName')} />
      </Form.Item>
      <CollectionSelect
        defaultValue={model?.status}
        name="status"
        label={t('forms.labels.taskStatus')}
        placeholder={t('common.selectTaskStatus')}
        rules={[{ required: true, type: 'string' }]}
        collection={TaskStatusCollection}
        subscription="taskStatus"
        FormComponent={TaskStatusForm}
      />
      <Form.Item label={t('tasks.participants')} name="participants" rules={[{ required: false, type: 'array' }]}>
        <Select mode="multiple" placeholder={t('forms.placeholders.selectParticipants')} allowClear options={participantOptions} optionFilterProp="label" />
      </Form.Item>
      <Form.Item label={t('tasks.priority')} name="priority" rules={[{ required: false, type: 'string' }]}>
        <Select
          placeholder={t('forms.placeholders.selectPriority')}
          allowClear
          options={[
            { value: 'low', label: t('tasks.low') },
            { value: 'medium', label: t('tasks.medium') },
            { value: 'high', label: t('tasks.high') },
          ]}
        />
      </Form.Item>
      <Form.Item label={t('tasks.link')} name="link" rules={[{ required: false, type: 'url' }]}>
        <Input placeholder={t('forms.placeholders.enterLink')} />
      </Form.Item>
      <Form.Item label={t('common.description')} name="description" rules={[{ required: false, type: 'string' }]}>
        <Input.TextArea autoSize placeholder={t('forms.placeholders.enterDescription')} />
      </Form.Item>
      <CollectionSelect
        defaultValue={model?.parent}
        name="parent"
        label={t('forms.labels.parentTask')}
        placeholder={t('common.selectTask')}
        rules={[{ required: false, type: 'string' }]}
        collection={TasksCollection}
        subscription="tasks"
        FormComponent={TaskForm}
      />
      <FormFooter setOpen={setOpen} />
    </Form>
  );
};
TaskForm.propTypes = {
  setOpen: PropTypes.func,
};

export default TaskForm;
