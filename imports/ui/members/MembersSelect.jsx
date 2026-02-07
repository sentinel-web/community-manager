import { Form, Select } from 'antd';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useEffect, useMemo, useState } from 'react';
import MembersCollection from '../../api/collections/members.collection';
import { useTranslation } from '../../i18n/LanguageContext';
import CollectionSelect from '../components/CollectionSelect';
import MemberForm from './MemberForm';

export default function MembersSelect({ multiple, name, label, rules, defaultValue, grouped }) {
  const { t } = useTranslation();

  if (grouped) {
    return <GroupedMembersSelect multiple={multiple} name={name} label={label} rules={rules} defaultValue={defaultValue} t={t} />;
  }

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
  grouped: PropTypes.bool,
};

function GroupedMembersSelect({ multiple, name, label, rules, defaultValue, t }) {
  const [options, setOptions] = useState([]);

  useEffect(() => {
    Meteor.callAsync('members.groupedOptions')
      .then(setOptions)
      .catch(() => {});
  }, []);

  const isFormItem = useMemo(() => name && label && rules, [name, label, rules]);

  const selectComponent = (
    <Select
      mode={multiple ? 'multiple' : undefined}
      placeholder={t('common.selectMembers')}
      options={options}
      optionFilterProp="label"
      showSearch
      allowClear
      style={{ width: '100%' }}
      defaultValue={defaultValue}
    />
  );

  if (isFormItem) {
    return (
      <Form.Item name={name} label={label} rules={rules}>
        {selectComponent}
      </Form.Item>
    );
  }

  return selectComponent;
}
GroupedMembersSelect.propTypes = {
  multiple: PropTypes.bool,
  name: PropTypes.string,
  label: PropTypes.string,
  rules: PropTypes.array,
  defaultValue: PropTypes.any,
  t: PropTypes.func,
};
