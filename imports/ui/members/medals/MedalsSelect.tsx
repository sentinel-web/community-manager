import type { Rule } from 'antd/es/form';
import React from 'react';
import MedalsCollection from '../../../api/collections/medals.collection';
import { useTranslation } from '../../../i18n/LanguageContext';
import CollectionSelect from '../../components/CollectionSelect';
import MedalsForm from './MedalsForm';

interface MedalsSelectProps {
  multiple?: boolean;
  name?: string;
  label?: string;
  rules?: Rule[];
  defaultValue?: string | string[];
}

export default function MedalsSelect({ multiple, name, label, rules, defaultValue }: MedalsSelectProps) {
  const { t } = useTranslation();
  return (
    <CollectionSelect
      defaultValue={defaultValue}
      name={name}
      label={label}
      rules={rules}
      mode={multiple ? 'multiple' : undefined}
      collection={MedalsCollection as never}
      FormComponent={MedalsForm}
      subscription="medals"
      placeholder={t('common.selectMedals')}
    />
  );
}
