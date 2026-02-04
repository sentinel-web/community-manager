import PropTypes from 'prop-types';
import React from 'react';
import SpecializationsCollection from '../../api/collections/specializations.collection';
import { useTranslation } from '../../i18n/LanguageContext';
import CollectionSelect from '../components/CollectionSelect';
import SpecializationForm from './SpecializationForm';

export default function SpecializationsSelect({ multiple, name, label, rules, defaultValue }) {
  const { t } = useTranslation();
  return (
    <CollectionSelect
      defaultValue={defaultValue}
      name={name}
      label={label}
      rules={rules}
      mode={multiple ? 'multiple' : undefined}
      collection={SpecializationsCollection}
      FormComponent={SpecializationForm}
      subscription="specializations"
      placeholder={t('common.selectSpecializations')}
      extra={<></>}
    />
  );
}
SpecializationsSelect.propTypes = {
  multiple: PropTypes.bool,
  name: PropTypes.string,
  label: PropTypes.string,
  rules: PropTypes.array,
  defaultValue: PropTypes.any,
};
