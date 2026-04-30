import type { Rule } from 'antd/es/form';
import { Mongo } from 'meteor/mongo';
import React from 'react';
import RanksCollection from '../../../api/collections/ranks.collection';
import { useTranslation } from '../../../i18n/LanguageContext';
import CollectionSelect from '../../components/CollectionSelect';
import RanksForm from './RanksForm';

interface RanksSelectProps {
  multiple?: boolean;
  name?: string;
  label?: string;
  rules?: Rule[];
  defaultValue?: string | string[];
}

const RanksSelect = ({ multiple, name, label, rules, defaultValue }: RanksSelectProps) => {
  const { t } = useTranslation();
  return (
    <CollectionSelect
      defaultValue={defaultValue}
      name={name}
      label={label}
      rules={rules}
      collection={RanksCollection as unknown as Mongo.Collection<{ _id?: string; name?: string; color?: string; profile?: { name?: string }; [key: string]: unknown }>}
      mode={multiple ? 'multiple' : undefined}
      FormComponent={RanksForm}
      subscription="ranks"
      placeholder={t('common.selectRank')}
      extra={<></>}
    />
  );
};

export default RanksSelect;
