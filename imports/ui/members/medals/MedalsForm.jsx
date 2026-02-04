import { App, ColorPicker, Form, Input } from 'antd';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';
import { DrawerContext, SubdrawerContext } from '../../app/App';
import FormFooter from '../../components/FormFooter';
import { getColorFromValues } from '../../specializations/SpecializationForm';

export default function MedalsForm({ setOpen, useSubdrawer }) {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const { message, notification } = App.useApp();
  const [loading, setLoading] = useState(false);

  const drawer = useContext(useSubdrawer ? SubdrawerContext : DrawerContext);
  const model = useMemo(() => {
    return drawer.drawerModel || {};
  }, [drawer]);

  useEffect(() => {
    if (Object.keys(model).length > 0) {
      form.setFieldsValue(model);
    } else {
      form.setFieldsValue({
        name: '',
        description: '',
        color: null,
        image: null,
      });
    }
  }, [model, form.setFieldsValue]);

  const handleSubmit = useCallback(
    values => {
      setLoading(true);
      const { name, description } = values;
      const args = [...(model?._id ? [model._id] : []), { name, color: getColorFromValues(values), description }];
      Meteor.callAsync(Meteor.user() && model?._id ? 'medals.update' : 'medals.insert', ...args)
        .then(() => {
          setOpen(false);
          form.resetFields();
          message.success(model?._id ? t('messages.medalUpdated') : t('messages.medalCreated'));
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
    [setOpen, form, model, message, notification, t]
  );

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit} disabled={loading}>
      <Form.Item name="name" label={t('common.name')} rules={[{ required: true, type: 'string' }]} required>
        <Input placeholder={t('forms.placeholders.enterName')} />
      </Form.Item>
      <Form.Item name="description" label={t('common.description')} rules={[{ required: false, type: 'string' }]}>
        <Input.TextArea autoSize placeholder={t('forms.placeholders.enterDescription')} />
      </Form.Item>
      <Form.Item name="color" label={t('common.color')}>
        <ColorPicker format="hex" />
      </Form.Item>
      <FormFooter setOpen={setOpen} />
    </Form>
  );
}
MedalsForm.propTypes = {
  setOpen: PropTypes.func,
  useSubdrawer: PropTypes.bool,
};
