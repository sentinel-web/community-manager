import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { App, Card, Checkbox, ColorPicker, Form, Input, Space, Switch, Typography } from 'antd';
import { Meteor } from 'meteor/meteor';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';
import { getColorFromValues } from '/imports/helpers/colors/getColorFromValues';
import type { TranslateFn } from '../../section/types';
import type { LocaleKey } from '/imports/i18n';
import type { CrudPermission, Role } from '../../../api/types/role';
import { useDrawerFrame } from '../../drawer-stack';
import FormFooter from '../../components/FormFooter';

interface RuleInputProps {
  name: string;
  label: string;
}

interface CrudPermissionInputProps {
  name: string;
  label: string;
  t: TranslateFn;
}

// Modules that use CRUD permissions - label keys reference navigation translations.
// `as const satisfies` preserves the literal union of labelKey values so t(labelKey)
// resolves to a paramless LocaleKey rather than the full LocaleKey union.
const CRUD_MODULES = [
  { name: 'members', labelKey: 'navigation.members' },
  { name: 'events', labelKey: 'navigation.events' },
  { name: 'tasks', labelKey: 'navigation.tasks' },
  { name: 'squads', labelKey: 'navigation.squads' },
  { name: 'ranks', labelKey: 'navigation.ranks' },
  { name: 'specializations', labelKey: 'navigation.specializations' },
  { name: 'medals', labelKey: 'navigation.medals' },
  { name: 'eventTypes', labelKey: 'navigation.eventTypes' },
  { name: 'briefingTemplates', labelKey: 'navigation.briefingTemplates' },
  { name: 'taskStatus', labelKey: 'navigation.taskStatus' },
  { name: 'registrations', labelKey: 'navigation.registrations' },
  { name: 'discoveryTypes', labelKey: 'navigation.discoveryTypes' },
  { name: 'roles', labelKey: 'navigation.roles' },
  { name: 'questionnaires', labelKey: 'navigation.questionnaires' },
  { name: 'positions', labelKey: 'navigation.positions' },
] as const satisfies readonly { name: string; labelKey: LocaleKey }[];

/**
 * Normalizes permission value for form initial values.
 * Converts old boolean format to CRUD object format.
 */
function normalizePermissionForForm(value: boolean | CrudPermission | undefined): CrudPermission {
  if (value === true) {
    return { read: true, create: true, update: true, delete: true };
  }
  if (value === false || value === undefined) {
    return { read: false, create: false, update: false, delete: false };
  }
  return value;
}

/**
 * Prepares model for form initialization by normalizing CRUD permissions.
 */
function prepareModelForForm(model: Role | null | undefined): Record<string, unknown> {
  if (!model) return {};

  const prepared: Record<string, unknown> = { ...model };
  for (const { name } of CRUD_MODULES) {
    prepared[name] = normalizePermissionForForm(model[name as keyof Role] as boolean | CrudPermission | undefined);
  }
  return prepared;
}

const RolesForm = () => {
  const { t } = useTranslation();
  const { model: rawModel, resolve, cancel } = useDrawerFrame<string, Partial<Role> & { _id?: string }>();
  const model = (rawModel || {}) as Role & { _id?: string };
  const { message, notification } = App.useApp();
  const { isUpdate, endpoint } = useMemo(
    () => (model?._id ? { isUpdate: true, endpoint: 'roles.update' } : { isUpdate: false, endpoint: 'roles.insert' }),
    [model?._id]
  );

  const handleFinish = useCallback(
    async (values: Record<string, unknown>) => {
      try {
        const args = [...(model?._id ? [model._id] : []), { ...values, color: getColorFromValues(values) }];
        const result = (await Meteor.callAsync(endpoint, ...args)) as string | undefined;
        message.success(isUpdate ? t('messages.roleUpdated') : t('messages.roleCreated'));
        resolve(model?._id ?? result);
      } catch (error) {
        notification.error({
          message: (error as Meteor.Error).error as string,
          description: (error as Meteor.Error).message,
        });
      }
    },
    [endpoint, model?._id, resolve, isUpdate, message, notification, t]
  );

  const [form] = Form.useForm<Record<string, unknown>>();
  const initialValues = useMemo(() => prepareModelForForm(model), [model]);

  return (
    <Form layout="vertical" form={form} onFinish={handleFinish} initialValues={initialValues}>
      <Form.Item name="name" label={t('common.name')} rules={[{ required: true, type: 'string' }]} required>
        <Input placeholder={t('forms.placeholders.enterName')} />
      </Form.Item>
      <Form.Item name="description" label={t('common.description')} rules={[{ required: false, type: 'string' }]}>
        <Input.TextArea placeholder={t('forms.placeholders.enterDescription')} />
      </Form.Item>
      <Form.Item name="color" label={t('common.color')}>
        <ColorPicker format="hex" />
      </Form.Item>

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
      <RuleInput name="canManageRecruits" label={t('members.canManageRecruits')} />
      <RuleInput name="canCreateEvents" label={t('members.canCreateEvents')} />
      <RuleInput name="canManageTasks" label={t('members.canManageTasks')} />

      <FormFooter onCancel={cancel} />
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
