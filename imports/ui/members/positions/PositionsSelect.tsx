import type { Rule } from 'antd/es/form';
import type { NamePath } from 'antd/es/form/interface';
import { Mongo } from 'meteor/mongo';
import React from 'react';
import PositionsCollection from '../../../api/collections/positions.collection';
import { useTranslation } from '../../../i18n/LanguageContext';
import CollectionSelect from '../../components/CollectionSelect';
import PositionsForm from './PositionsForm';

interface PositionsSelectProps {
  multiple?: boolean;
  name?: NamePath;
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
      collection={PositionsCollection as unknown as Mongo.Collection<{ _id?: string; name?: string; color?: string; profile?: { name?: string }; [key: string]: unknown }>}
      FormComponent={PositionsForm}
      subscription="positions"
      placeholder={t('common.selectPosition')}
    />
  );
}
