import PropTypes from 'prop-types';
import React from 'react';
import MembersCollection from '../../api/collections/members.collection';
import { useTranslation } from '../../i18n/LanguageContext';
import CollectionSelect from '../components/CollectionSelect';
import MemberForm from './MemberForm';

export default function MembersSelect({ multiple, name, label, rules, defaultValue }) {
  const { t } = useTranslation();
  return (
    <CollectionSelect
      defaultValue={defaultValue}
      name={name}
      label={label}
      rules={rules}
      mode={multiple ? 'multiple' : undefined}
      collection={MembersCollection}
      FormComponent={MemberForm}
      subscription="members"
      placeholder={t('common.selectMembers')}
      extra={<></>}
    />
  );
}
MembersSelect.propTypes = {
  multiple: PropTypes.bool,
  name: PropTypes.string,
  label: PropTypes.string,
  rules: PropTypes.array,
  defaultValue: PropTypes.any,
};
