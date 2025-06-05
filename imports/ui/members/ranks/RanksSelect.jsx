import PropTypes from 'prop-types';
import React from 'react';
import RanksCollection from '../../../api/collections/ranks.collection';
import CollectionSelect from '../../components/CollectionSelect';
import RanksForm from './RanksForm';

RanksSelect.propTypes = {
  multiple: PropTypes.bool,
  name: PropTypes.string,
  label: PropTypes.string,
  rules: PropTypes.array,
  defaultValue: PropTypes.any,
};
const RanksSelect = ({ multiple, name, label, rules, defaultValue }) => {
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
      placeholder={multiple ? 'Select ranks' : 'Select rank'}
      extra={<></>}
    />
  );
};

export default RanksSelect;
