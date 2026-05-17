import type { Rule } from 'antd/es/form';
import type { NamePath } from 'antd/es/form/interface';
import { Mongo } from 'meteor/mongo';
import React from 'react';
import { useTranslation } from '../../i18n/LanguageContext';
import CollectionSelect from '../components/CollectionSelect';
import SquadsCollection from '../../api/collections/squads.collection';
import SquadsForm from './SquadsForm';

type CollectionDoc = {
  _id?: string;
  name?: string;
  color?: string;
  profile?: { name?: string };
  [key: string]: unknown;
};

interface SquadsSelectProps {
  multiple?: boolean;
  name?: NamePath;
  label?: string;
  rules?: Rule[];
  defaultValue?: string | string[];
}

export default function SquadsSelect({ multiple, name, label, rules, defaultValue }: SquadsSelectProps) {
  const { t } = useTranslation();
  return (
    <CollectionSelect
      defaultValue={defaultValue}
      name={name}
      label={label}
      rules={rules}
      mode={multiple ? 'multiple' : undefined}
      collection={SquadsCollection as unknown as Mongo.Collection<CollectionDoc>}
      FormComponent={SquadsForm}
      subscription="squads"
      placeholder={t('common.selectSquad')}
      extra={<></>}
      useDrawerStack
    />
  );
}
