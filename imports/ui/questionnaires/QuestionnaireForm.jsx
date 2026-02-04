import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Form, Input, Select, Space, Switch } from 'antd';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useCallback, useContext, useMemo } from 'react';
import { DrawerContext } from '../app/App';
import FormFooter from '../components/FormFooter';

const QUESTION_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Single Choice' },
  { value: 'multiselect', label: 'Multiple Choice' },
  { value: 'rating', label: 'Rating (1-5)' },
];

const INTERVAL_OPTIONS = [
  { value: 'once', label: 'Once (one response only)' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'unlimited', label: 'Unlimited' },
];

const QuestionnaireForm = ({ setOpen }) => {
  const { drawerModel: model } = useContext(DrawerContext);
  const { message, notification } = App.useApp();
  const { isUpdate, endpoint } = useMemo(
    () => (model?._id ? { isUpdate: true, endpoint: 'questionnaires.update' } : { isUpdate: false, endpoint: 'questionnaires.insert' }),
    [model?._id]
  );

  const handleFinish = useCallback(
    async values => {
      try {
        const payload = {
          ...values,
          createdAt: model?.createdAt || new Date(),
          updatedAt: new Date(),
        };
        const args = isUpdate ? [model._id, payload] : [payload];
        await Meteor.callAsync(endpoint, ...args);
        setOpen(false);
        message.success(isUpdate ? 'Questionnaire updated' : 'Questionnaire created');
      } catch (error) {
        notification.error({
          message: error.error,
          description: error.message,
        });
      }
    },
    [setOpen, endpoint, model?._id, model?.createdAt, isUpdate, message, notification]
  );

  const [form] = Form.useForm();

  return (
    <Form layout="vertical" form={form} onFinish={handleFinish} initialValues={model}>
      <Form.Item label="Name" name="name" rules={[{ required: true, type: 'string', message: 'Please enter a name' }]} required>
        <Input placeholder="Enter questionnaire name" />
      </Form.Item>
      <Form.Item label="Description" name="description" rules={[{ required: false, type: 'string' }]}>
        <Input.TextArea autoSize placeholder="Enter description" />
      </Form.Item>
      <Form.Item label="Status" name="status" rules={[{ required: false, type: 'string' }]} initialValue="draft">
        <Select
          placeholder="Select status"
          options={[
            { value: 'draft', label: 'Draft' },
            { value: 'active', label: 'Active' },
            { value: 'closed', label: 'Closed' },
          ]}
        />
      </Form.Item>
      <Form.Item
        label="Allow Anonymous Responses"
        name="allowAnonymous"
        valuePropName="checked"
        tooltip="When enabled, responses are not linked to user accounts"
      >
        <Switch />
      </Form.Item>
      <Form.Item
        label="Response Interval"
        name="interval"
        initialValue="once"
        tooltip="How often users can submit responses"
      >
        <Select placeholder="Select interval" options={INTERVAL_OPTIONS} />
      </Form.Item>

      <Card title="Questions" size="small" style={{ marginBottom: 16 }}>
        <Form.List name="questions">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...restField }) => (
                <QuestionItem key={key} name={name} restField={restField} remove={remove} />
              ))}
              <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                Add Question
              </Button>
            </>
          )}
        </Form.List>
      </Card>

      <FormFooter setOpen={setOpen} />
    </Form>
  );
};
QuestionnaireForm.propTypes = {
  setOpen: PropTypes.func,
};

const QuestionItem = ({ name, restField, remove }) => {
  const form = Form.useFormInstance();
  const questionType = Form.useWatch(['questions', name, 'type'], form);

  return (
    <Card size="small" style={{ marginBottom: 12 }}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Space align="start" style={{ width: '100%', justifyContent: 'space-between' }}>
          <Form.Item
            {...restField}
            name={[name, 'text']}
            rules={[{ required: true, message: 'Please enter a question' }]}
            style={{ marginBottom: 8, flex: 1 }}
          >
            <Input placeholder="Question text" />
          </Form.Item>
          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
        </Space>
        <Space wrap>
          <Form.Item {...restField} name={[name, 'type']} rules={[{ required: true, message: 'Select a type' }]} style={{ marginBottom: 8 }}>
            <Select placeholder="Question type" options={QUESTION_TYPES} style={{ width: 150 }} />
          </Form.Item>
          <Form.Item {...restField} name={[name, 'required']} style={{ marginBottom: 8 }}>
            <Select
              placeholder="Required?"
              options={[
                { value: true, label: 'Required' },
                { value: false, label: 'Optional' },
              ]}
              style={{ width: 110 }}
              defaultValue={false}
            />
          </Form.Item>
        </Space>
        {(questionType === 'select' || questionType === 'multiselect') && (
          <Form.Item
            {...restField}
            name={[name, 'options']}
            rules={[{ required: true, message: 'Please add options' }]}
            style={{ marginBottom: 8 }}
          >
            <Select mode="tags" placeholder="Add options (press Enter after each)" tokenSeparators={[',']} />
          </Form.Item>
        )}
      </Space>
    </Card>
  );
};
QuestionItem.propTypes = {
  name: PropTypes.number,
  restField: PropTypes.object,
  remove: PropTypes.func,
};

export default QuestionnaireForm;
