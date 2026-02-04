import PropTypes from 'prop-types';
import React from 'react';
import RanksCollection from '../../../api/collections/ranks.collection';
import { useTranslation } from '../../../i18n/LanguageContext';
import CollectionSelect from '../../components/CollectionSelect';
import RanksForm from './RanksForm';

const RanksSelect = ({ multiple, name, label, rules, defaultValue }) => {
  const { t } = useTranslation();
  return (
    <CollectionSelect
      defaultValue={defaultValue}
      name={name}
      label={label}
      rules={rules}
      collection={RanksCollection}
      mode={multiple ? 'multiple' : undefined}
      FormComponent={RanksForm}
      subscription="ranks"
      placeholder={t('common.selectRank')}
      extra={<></>}
    />
  );
};
RanksSelect.propTypes = {
  multiple: PropTypes.bool,
  name: PropTypes.string,
  label: PropTypes.string,
  rules: PropTypes.array,
  defaultValue: PropTypes.any,
};

export default RanksSelect;
