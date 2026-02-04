import { App, ColorPicker, Form, Input, Select } from 'antd';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';
import { DrawerContext, SubdrawerContext } from '../../app/App';
import FormFooter from '../../components/FormFooter';
import { getColorFromValues } from '../../specializations/SpecializationForm';
import RanksSelect from './RanksSelect';

export default function RanksForm({ setOpen, useSubdrawer }) {
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
        previousRankId: null,
        nextRankId: null,
      });
    }
  }, [model, form.setFieldsValue]);

  const handleSubmit = useCallback(
    values => {
      setLoading(true);
      const { name, description, previousRankId, nextRankId, type } = values;
      const args = [...(model?._id ? [model._id] : []), { name, color: getColorFromValues(values), description, previousRankId, nextRankId, type }];
      Meteor.callAsync(Meteor.user() && model?._id ? 'ranks.update' : 'ranks.insert', ...args)
        .then(() => {
          setOpen(false);
          form.resetFields();
          message.success(model?._id ? t('messages.rankUpdated') : t('messages.rankCreated'));
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
      <Form.Item name="type" label={t('members.type')} rules={[{ required: true, type: 'string' }]} required>
        <Select
          placeholder={t('common.selectType')}
          options={[
            { label: t('members.playerRank'), value: 'player' },
            { label: t('members.zeusRank'), value: 'zeus' },
          ]}
        />
      </Form.Item>
      <Form.Item name="description" label={t('common.description')} rules={[{ required: false, type: 'string' }]}>
        <Input.TextArea autoSize placeholder={t('forms.placeholders.enterDescription')} />
      </Form.Item>
      <Form.Item name="color" label={t('common.color')}>
        <ColorPicker format="hex" />
      </Form.Item>
      <RanksSelect name="previousRankId" label={t('members.previousRank')} rules={[{ required: false, type: 'string' }]} defaultValue={model?.previousRankId} />
      <RanksSelect name="nextRankId" label={t('members.nextRank')} rules={[{ required: false, type: 'string' }]} defaultValue={model?.nextRankId} />
      <FormFooter setOpen={setOpen} />
    </Form>
  );
}
RanksForm.propTypes = {
  setOpen: PropTypes.func,
  useSubdrawer: PropTypes.bool,
};
