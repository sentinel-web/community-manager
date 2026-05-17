import type { Rule } from 'antd/es/form';
import type { NamePath } from 'antd/es/form/interface';
import { Mongo } from 'meteor/mongo';
import React from 'react';
import MedalsCollection from '../../../api/collections/medals.collection';
import { useTranslation } from '../../../i18n/LanguageContext';
import CollectionSelect, { type CollectionDoc } from '../../components/CollectionSelect';
import MedalsForm from './MedalsForm';

interface MedalsSelectProps {
  multiple?: boolean;
  name?: NamePath;
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
      collection={MedalsCollection as unknown as Mongo.Collection<CollectionDoc>}
      FormComponent={MedalsForm}
      subscription="medals"
      placeholder={t('common.selectMedals')}
      useDrawerStack
    />
  );
}
