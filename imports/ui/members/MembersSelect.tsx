import { Form, Select } from 'antd';
import type { Rule } from 'antd/es/form';
import type { NamePath } from 'antd/es/form/interface';
import type { DefaultOptionType } from 'antd/es/select';
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import React, { useEffect, useMemo, useState } from 'react';
import MembersCollection from '../../api/collections/members.collection';
import type { LanguageContextValue } from '../../i18n/LanguageContext';
import { useTranslation } from '../../i18n/LanguageContext';
import CollectionSelect, { type CollectionDoc } from '../components/CollectionSelect';
import MemberForm from './MemberForm';

interface MembersSelectProps {
  multiple?: boolean;
  name?: NamePath;
  label?: string;
  rules?: Rule[];
  defaultValue?: string | string[];
  grouped?: boolean;
}

export default function MembersSelect({ multiple, name, label, rules, defaultValue, grouped }: MembersSelectProps) {
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
      collection={MembersCollection as unknown as Mongo.Collection<CollectionDoc>}
      FormComponent={MemberForm}
      subscription="members"
      placeholder={t('common.selectMembers')}
      extra={<></>}
    />
  );
}

interface GroupedMembersSelectProps {
  multiple?: boolean;
  name?: NamePath;
  label?: string;
  rules?: Rule[];
  defaultValue?: string | string[];
  t: LanguageContextValue['t'];
}

function GroupedMembersSelect({ multiple, name, label, rules, defaultValue, t }: GroupedMembersSelectProps) {
  const [options, setOptions] = useState<DefaultOptionType[]>([]);

  useEffect(() => {
    Meteor.callAsync('members.groupedOptions')
      .then((data: DefaultOptionType[]) => setOptions(data))
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
