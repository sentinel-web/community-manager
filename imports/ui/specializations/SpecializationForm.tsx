import { App, Col, ColorPicker, Form, Input, Row } from 'antd';
import type { Rule } from 'antd/es/form';
import { Meteor } from 'meteor/meteor';
import React, { ComponentType, useCallback, useContext, useMemo } from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';
import type { DrawerContextValue } from '../app/types';
import { DrawerContext, SubdrawerContext } from '../app/App';
import FormFooter from '../components/FormFooter';
import MembersSelect from '../members/MembersSelect';
import RanksSelect from '../members/ranks/RanksSelect';
import SpecializationsSelect from './SpecializationsSelect';
import type { Specialization } from '../../api/types/misc';

/** Shared props that MembersSelect and RanksSelect accept (still .jsx, typed via cast) */
interface SelectFieldProps {
  multiple?: boolean;
  name?: string;
  label?: string;
  rules?: Rule[];
  defaultValue?: string | string[];
  grouped?: boolean;
}

const MembersSelectTyped = MembersSelect as ComponentType<SelectFieldProps>;
const RanksSelectTyped = RanksSelect as ComponentType<SelectFieldProps>;

interface SpecializationFormValues {
  name: string;
  color?: string | { toHexString?: () => string };
  linkToFile?: string;
  instructors?: string[];
  requiredSpecializations?: string[];
  requiredRankId?: string;
  description?: string;
}

interface SpecializationFormProps {
  setOpen: (open: boolean) => void;
  useSubdrawer?: boolean;
}

export function getColorFromValues(values: SpecializationFormValues): string | undefined {
  return values?.color ? (values.color as { toHexString?: () => string })?.toHexString?.() || (values.color as string) : undefined;
}

const SpecializationForm = ({ setOpen, useSubdrawer }: SpecializationFormProps) => {
  const { t } = useTranslation();
  const drawer = useContext(DrawerContext) as DrawerContextValue;
  const subdrawer = useContext(SubdrawerContext) as DrawerContextValue;
  const { message, notification } = App.useApp();

  const { model, endpoint } = useMemo(() => {
    const newModel = ((useSubdrawer ? subdrawer.drawerModel : drawer.drawerModel) || {}) as unknown as Specialization;
    return { model: newModel, endpoint: newModel?._id ? 'specializations.update' : 'specializations.insert' };
  }, [drawer, subdrawer, useSubdrawer]);

  const handleFinish = useCallback(
    async (values: SpecializationFormValues) => {
      const color = getColorFromValues(values);
      values.color = color;
      const args = [...(model?._id ? [model._id] : []), values];
      Meteor.callAsync(endpoint, ...args)
        .then(() => {
          message.success(model?._id ? t('messages.specializationUpdated') : t('messages.specializationCreated'));
          setOpen(false);
        })
        .catch((error: Meteor.Error) => {
          notification.error({
            message: error.error as string,
            description: error.message,
          });
        });
    },
    [setOpen, notification, message, model?._id, endpoint, t]
  );

  const [form] = Form.useForm<SpecializationFormValues>();

  return (
    <Form layout="vertical" form={form} onFinish={handleFinish} initialValues={model}>
      <Form.Item name="name" label={t('common.name')} rules={[{ required: true, type: 'string' }]}>
        <Input placeholder={t('forms.placeholders.enterName')} />
      </Form.Item>
      <Row gutter={[16, 16]} align="middle" justify="space-between">
        <Col flex="auto">
          <Form.Item name="linkToFile" label={t('specializations.linkToFile')} rules={[{ required: false, type: 'string' }]}>
            <Input placeholder={t('forms.placeholders.enterLinkToFile')} />
          </Form.Item>
        </Col>
        <Col>
          <Form.Item name="color" label={t('common.color')}>
            <ColorPicker />
          </Form.Item>
        </Col>
      </Row>
      <MembersSelectTyped multiple name="instructors" label={t('specializations.instructors')} rules={[{ required: false, type: 'array' }]} defaultValue={model?.instructors} />
      <SpecializationsSelect
        multiple
        name="requiredSpecializations"
        label={t('specializations.requiredSpecializations')}
        rules={[{ required: false, type: 'array' }]}
        defaultValue={model?.requiredSpecializations}
      />
      <RanksSelectTyped name="requiredRankId" label={t('specializations.requiredRank')} rules={[{ required: false, type: 'string' }]} defaultValue={model?.requiredRankId} />
      <Form.Item name="description" label={t('common.description')} rules={[{ required: false, type: 'string' }]}>
        <Input.TextArea autoSize placeholder={t('forms.placeholders.enterDescription')} />
      </Form.Item>
      <FormFooter setOpen={setOpen} />
    </Form>
  );
};

export default SpecializationForm;
