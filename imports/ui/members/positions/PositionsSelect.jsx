import PropTypes from 'prop-types';
import React from 'react';
import PositionsCollection from '../../../api/collections/positions.collection';
import { useTranslation } from '../../../i18n/LanguageContext';
import CollectionSelect from '../../components/CollectionSelect';
import PositionsForm from './PositionsForm';

export default function PositionsSelect({ multiple, name, label, rules, defaultValue }) {
  const { t } = useTranslation();
  return (
    <CollectionSelect
      defaultValue={defaultValue}
      name={name}
      label={label}
      rules={rules}
      mode={multiple ? 'multiple' : undefined}
      collection={PositionsCollection}
      FormComponent={PositionsForm}
      subscription="positions"
      placeholder={t('common.selectPosition')}
    />
  );
}
PositionsSelect.propTypes = {
  multiple: PropTypes.bool,
  name: PropTypes.string,
  label: PropTypes.string,
  rules: PropTypes.array,
  defaultValue: PropTypes.any,
};
