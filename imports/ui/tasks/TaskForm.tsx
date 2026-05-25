import { CommentOutlined, SendOutlined } from '@ant-design/icons';
import { App, Button, Divider, Form, Input, List, Select, Typography } from 'antd';
import dayjs from 'dayjs';
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import TasksCollection from '../../api/collections/tasks.collection';
import TaskStatusCollection from '../../api/collections/taskStatus.collection';
import type { Task, TaskComment } from '../../api/types/task';
import { useTranslation } from '../../i18n/LanguageContext';
import { useDrawerFrame } from '../drawer-stack';
import CollectionSelect, { type CollectionDoc } from '../components/CollectionSelect';
import FormFooter from '../components/FormFooter';
import useMethod from '../hooks/useMethod';
import MembersSelectJs from '../members/MembersSelect';
import TaskStatusForm from './task-status/TaskStatusForm';

// MembersSelect is a JS component — cast to allow flexible prop passing from TSX
const MembersSelect = MembersSelectJs as unknown as React.ComponentType<Record<string, unknown>>;

interface MemberOption {
  value: string;
  label: string;
}

export default function TaskForm() {
  const { model, resolve, cancel } = useDrawerFrame<string, Partial<Task>>();
  const { message, notification } = App.useApp();
  const { t } = useTranslation();
  const { isUpdate, endpoint } = useMemo(
    () => (model?._id ? { isUpdate: true, endpoint: 'tasks.update' } : { isUpdate: false, endpoint: 'tasks.insert' }),
    [model?._id]
  );

  const handleFinish = useCallback(
    async (values: Partial<Task>) => {
      try {
        const args = isUpdate ? [model._id as string, values] : [values];
        const result = (await Meteor.callAsync(endpoint, ...args)) as string | undefined;
        message.success(isUpdate ? t('messages.taskUpdated') : t('messages.taskCreated'));
        resolve(model?._id ?? result);
      } catch (error) {
        const err = error as Meteor.Error;
        notification.error({
          message: err.error as string,
          description: err.message,
        });
      }
    },
    [resolve, endpoint, model?._id, isUpdate, message, notification, t]
  );

  const [participantOptions, setParticipantOptions] = useState<MemberOption[]>([]);
  const { call: fetchMemberOptions } = useMethod<MemberOption[]>('members.options');
  useEffect(() => {
    fetchMemberOptions().then(res => res.ok && setParticipantOptions(res.data));
  }, [fetchMemberOptions]);

  const [form] = Form.useForm();

  // Comments state
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<TaskComment[]>(model?.comments || []);
  const [commentLoading, setCommentLoading] = useState(false);

  const memberNames = useMemo(() => {
    const map: Record<string, string> = {};
    participantOptions.forEach(o => {
      map[o.value] = o.label;
    });
    return map;
  }, [participantOptions]);

  const handleAddComment = useCallback(async () => {
    if (!commentText.trim() || !model?._id) return;
    setCommentLoading(true);
    try {
      await Meteor.callAsync('tasks.addComment', model._id, commentText.trim());
      setComments(prev => [...prev, { userId: Meteor.userId() as string, text: commentText.trim(), createdAt: new Date() }]);
      setCommentText('');
      message.success(t('tasks.commentAdded'));
    } catch (error) {
      const err = error as Meteor.Error;
      notification.error({ message: err.error as string, description: err.message });
    }
    setCommentLoading(false);
  }, [commentText, model?._id, message, notification, t]);

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
        collection={TaskStatusCollection as unknown as Mongo.Collection<CollectionDoc>}
        subscription="taskStatus"
        FormComponent={TaskStatusForm}
      />
      <Form.Item label={t('tasks.participants')} name="participants" rules={[{ required: false, type: 'array' }]}>
        <Select
          mode="multiple"
          placeholder={t('forms.placeholders.selectParticipants')}
          allowClear
          options={participantOptions}
          optionFilterProp="label"
        />
      </Form.Item>
      <MembersSelect multiple name="completedBy" label={t('tasks.completedBy')} rules={[{ type: 'array' }]} defaultValue={model?.completedBy} />
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
        collection={TasksCollection as unknown as Mongo.Collection<CollectionDoc>}
        subscription="tasks"
        FormComponent={TaskForm}
      />
      <FormFooter onCancel={cancel} />

      {/* Comments Section */}
      {isUpdate && (
        <>
          <Divider>{t('tasks.comments')}</Divider>
          <List
            dataSource={comments}
            locale={{ emptyText: '-' }}
            renderItem={item => (
              <List.Item>
                <List.Item.Meta
                  avatar={<CommentOutlined />}
                  title={<Typography.Text strong>{memberNames[item.userId] || item.userId}</Typography.Text>}
                  description={
                    <>
                      <Typography.Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{item.text}</Typography.Paragraph>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')}
                      </Typography.Text>
                    </>
                  }
                />
              </List.Item>
            )}
          />
          <Input.TextArea
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            placeholder={t('tasks.commentPlaceholder')}
            autoSize={{ minRows: 2 }}
            style={{ marginTop: 8 }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleAddComment}
            loading={commentLoading}
            disabled={!commentText.trim()}
            style={{ marginTop: 8 }}
          >
            {t('tasks.addComment')}
          </Button>
        </>
      )}
    </Form>
  );
}
