import PropTypes from 'prop-types';
import React from 'react';
import MedalsCollection from '../../../api/collections/medals.collection';
import CollectionSelect from '../../components/CollectionSelect';
import MedalsForm from './MedalsForm';

export default function MedalsSelect({ multiple, name, label, rules, defaultValue }) {
  return (
    <CollectionSelect
      defaultValue={defaultValue}
      name={name}
      label={label}
      rules={rules}
      mode={multiple ? 'multiple' : undefined}
      collection={MedalsCollection}
      FormComponent={MedalsForm}
      subscription="medals"
    />
  );
}
MedalsSelect.propTypes = {
  multiple: PropTypes.bool,
  name: PropTypes.string,
  label: PropTypes.string,
  rules: PropTypes.array,
  defaultValue: PropTypes.any,
};
