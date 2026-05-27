import { Col, ColorPicker, Form, Input, Row } from 'antd';
import type { Rule } from 'antd/es/form';
import React, { ComponentType, useMemo } from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';
import useEntityForm from '../hooks/useEntityForm';
import FormFooter from '../components/FormFooter';
import MembersSelect from '../members/MembersSelect';
import RanksSelect from '../members/ranks/RanksSelect';
import SpecializationsSelect from './SpecializationsSelect';
import type { Specialization } from '../../api/types/misc';

import { getColorFromValues } from '/imports/helpers/colors/getColorFromValues';

export { getColorFromValues };

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

const SpecializationForm = () => {
  const { t } = useTranslation();
  const {
    onFinish,
    loading,
    model: rawModel,
    cancel,
  } = useEntityForm<SpecializationFormValues, Partial<Specialization> & { _id?: string }>({
    collection: 'specializations',
    created: 'messages.specializationCreated',
    updated: 'messages.specializationUpdated',
    toPayload: values => ({ ...values, color: getColorFromValues(values) }),
  });

  const model = useMemo(() => (rawModel || {}) as unknown as Specialization, [rawModel]);

  const [form] = Form.useForm<SpecializationFormValues>();

  return (
    <Form layout="vertical" form={form} onFinish={onFinish} initialValues={model} disabled={loading}>
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
      <MembersSelectTyped
        multiple
        name="instructors"
        label={t('specializations.instructors')}
        rules={[{ required: false, type: 'array' }]}
        defaultValue={model?.instructors}
      />
      <SpecializationsSelect
        multiple
        name="requiredSpecializations"
        label={t('specializations.requiredSpecializations')}
        rules={[{ required: false, type: 'array' }]}
        defaultValue={model?.requiredSpecializations}
      />
      <RanksSelectTyped
        name="requiredRankId"
        label={t('specializations.requiredRank')}
        rules={[{ required: false, type: 'string' }]}
        defaultValue={model?.requiredRankId}
      />
      <Form.Item name="description" label={t('common.description')} rules={[{ required: false, type: 'string' }]}>
        <Input.TextArea autoSize placeholder={t('forms.placeholders.enterDescription')} />
      </Form.Item>
      <FormFooter onCancel={cancel} loading={loading} />
    </Form>
  );
};

export default SpecializationForm;
