import PropTypes from 'prop-types';
import React from 'react';
import SquadsCollection from '../../api/collections/squads.collection';
import { useTranslation } from '../../i18n/LanguageContext';
import CollectionSelect from '../components/CollectionSelect';
import SquadsForm from './SquadsForm';

export default function SquadsSelect({ multiple, name, label, rules, defaultValue }) {
  const { t } = useTranslation();
  return (
    <CollectionSelect
      defaultValue={defaultValue}
      name={name}
      label={label}
      rules={rules}
      mode={multiple ? 'multiple' : undefined}
      collection={SquadsCollection}
      FormComponent={SquadsForm}
      subscription="squads"
      placeholder={t('common.selectSquad')}
      extra={<></>}
    />
  );
}
SquadsSelect.propTypes = {
  multiple: PropTypes.bool,
  name: PropTypes.string,
  label: PropTypes.string,
  rules: PropTypes.array,
  defaultValue: PropTypes.any,
};
