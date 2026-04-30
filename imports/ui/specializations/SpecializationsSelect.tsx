import type { Rule } from 'antd/es/form';
import type { NamePath } from 'antd/es/form/interface';
import { Mongo } from 'meteor/mongo';
import React from 'react';
import SpecializationsCollection from '../../api/collections/specializations.collection';
import { useTranslation } from '../../i18n/LanguageContext';
import CollectionSelect from '../components/CollectionSelect';
import SpecializationForm from './SpecializationForm';

type CollectionDoc = { _id?: string; name?: string; color?: string; [key: string]: unknown };

interface SpecializationsSelectProps {
  multiple?: boolean;
  name?: NamePath;
  label?: string;
  rules?: Rule[];
  defaultValue?: string | string[];
}

export default function SpecializationsSelect({ multiple, name, label, rules, defaultValue }: SpecializationsSelectProps) {
  const { t } = useTranslation();
  return (
    <CollectionSelect
      defaultValue={defaultValue}
      name={name}
      label={label}
      rules={rules}
      mode={multiple ? 'multiple' : undefined}
      collection={SpecializationsCollection as unknown as Mongo.Collection<CollectionDoc>}
      FormComponent={SpecializationForm}
      subscription="specializations"
      placeholder={t('common.selectSpecializations')}
      extra={<></>}
    />
  );
}
