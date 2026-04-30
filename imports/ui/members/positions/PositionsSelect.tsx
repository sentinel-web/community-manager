import type { Rule } from 'antd/es/form';
import React from 'react';
import PositionsCollection from '../../../api/collections/positions.collection';
import { useTranslation } from '../../../i18n/LanguageContext';
import CollectionSelect from '../../components/CollectionSelect';
import PositionsForm from './PositionsForm';

interface PositionsSelectProps {
  multiple?: boolean;
  name?: string;
  label?: string;
  rules?: Rule[];
  defaultValue?: string | string[];
}

export default function PositionsSelect({ multiple, name, label, rules, defaultValue }: PositionsSelectProps) {
  const { t } = useTranslation();
  return (
    <CollectionSelect
      defaultValue={defaultValue}
      name={name}
      label={label}
      rules={rules}
      mode={multiple ? 'multiple' : undefined}
      collection={PositionsCollection as never}
      FormComponent={PositionsForm}
      subscription="positions"
      placeholder={t('common.selectPosition')}
    />
  );
}
