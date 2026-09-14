import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { Card, Checkbox, ColorPicker, Form, Input, Space, Switch, Typography } from 'antd';
import React, { useMemo } from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';
import { getColorFromValues } from '/imports/helpers/colors/getColorFromValues';
import type { TranslateFn } from '../../section/types';
import type { Role } from '../../../api/types/role';
import useEntityForm from '../../hooks/useEntityForm';
import FormFooter from '../../components/FormFooter';
import { ADMIN_FIELD, CRUD_MODULES, buildRolePayload, prepareRoleForForm } from './roleFormModel';

interface RuleInputProps {
  name: string;
  label: string;
}

interface CrudPermissionInputProps {
  name: string;
  label: string;
  t: TranslateFn;
}

const RolesForm = () => {
  const { t } = useTranslation();
  const { onFinish, loading, model, cancel } = useEntityForm<Record<string, unknown>, Partial<Role> & { _id?: string }>({
    collection: 'roles',
    created: 'messages.roleCreated',
    updated: 'messages.roleUpdated',
    toPayload: values => ({ ...buildRolePayload(values), color: getColorFromValues(values) }),
  });

  const [form] = Form.useForm<Record<string, unknown>>();
  const initialValues = useMemo(() => prepareRoleForForm(model), [model]);
  // Module permissions are irrelevant while the admin grant is on, so they are
  // hidden (not unmounted — their values stay registered for when it is turned off).
  const isAdmin = Form.useWatch(ADMIN_FIELD, form) === true;

  return (
    <Form layout="vertical" form={form} onFinish={onFinish} initialValues={initialValues} disabled={loading}>
      <Form.Item name="name" label={t('common.name')} rules={[{ required: true, type: 'string' }]} required>
        <Input placeholder={t('forms.placeholders.enterName')} />
      </Form.Item>
      <Form.Item name="description" label={t('common.description')} rules={[{ required: false, type: 'string' }]}>
        <Input.TextArea placeholder={t('forms.placeholders.enterDescription')} />
      </Form.Item>
      <Form.Item name="color" label={t('common.color')}>
        <ColorPicker format="hex" />
      </Form.Item>

      <Form.Item name={ADMIN_FIELD} label={t('members.administrator')} extra={t('members.administratorHint')} valuePropName="checked">
        <Switch checkedChildren={<CheckOutlined />} unCheckedChildren={<CloseOutlined />} />
      </Form.Item>

      <div hidden={isAdmin}>
        <Typography.Title level={5} style={{ marginTop: 16 }}>
          {t('members.basicPermissions')}
        </Typography.Title>
        <RuleInput name="dashboard" label={t('navigation.dashboard')} />
        <RuleInput name="orbat" label={t('navigation.orbat')} />
        <RuleInput name="logs" label={t('navigation.logs')} />
        <RuleInput name="settings" label={t('navigation.settings')} />

        <Typography.Title level={5} style={{ marginTop: 16 }}>
          {t('members.crudPermissions')}
        </Typography.Title>
        {CRUD_MODULES.map(({ name, labelKey }) => (
          <CrudPermissionInput key={name} name={name} label={t(labelKey)} t={t} />
        ))}

        <Typography.Title level={5} style={{ marginTop: 16 }}>
          {t('members.specialPermissions')}
        </Typography.Title>
        <RuleInput name="canManageSpecializations" label={t('members.canManageSpecializations')} />
        <RuleInput name="canCreateEvents" label={t('members.canCreateEvents')} />
        <RuleInput name="canManageTasks" label={t('members.canManageTasks')} />
      </div>

      <FormFooter onCancel={cancel} loading={loading} />
    </Form>
  );
};

const RuleInput = ({ name, label }: RuleInputProps) => {
  return (
    <Form.Item name={name} label={label} rules={[{ required: false, type: 'boolean' }]} valuePropName="checked">
      <Switch checkedChildren={<CheckOutlined />} unCheckedChildren={<CloseOutlined />} />
    </Form.Item>
  );
};

const CrudPermissionInput = ({ name, label, t }: CrudPermissionInputProps) => {
  return (
    <Card size="small" title={label} style={{ marginBottom: 16 }}>
      <Space wrap>
        <Form.Item name={[name, 'read']} valuePropName="checked" style={{ marginBottom: 0 }}>
          <Checkbox>{t('common.read')}</Checkbox>
        </Form.Item>
        <Form.Item name={[name, 'create']} valuePropName="checked" style={{ marginBottom: 0 }}>
          <Checkbox>{t('common.create')}</Checkbox>
        </Form.Item>
        <Form.Item name={[name, 'update']} valuePropName="checked" style={{ marginBottom: 0 }}>
          <Checkbox>{t('common.update')}</Checkbox>
        </Form.Item>
        <Form.Item name={[name, 'delete']} valuePropName="checked" style={{ marginBottom: 0 }}>
          <Checkbox>{t('common.delete')}</Checkbox>
        </Form.Item>
      </Space>
    </Card>
  );
};

export default RolesForm;
