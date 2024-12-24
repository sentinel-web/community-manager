import React, { useEffect, useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { Form, Select } from 'antd';

export default function MembersSelect({ multiple, name, label, rules }) {
  const [memberOptions, setMemberOptions] = useState([]);
  useEffect(() => {
    Meteor.callAsync('members.options').then(res => setMemberOptions(res));
  }, []);

  return (
    <Form.Item name={name} label={label} rules={rules}>
      <Select
        placeholder={multiple ? 'Select members' : 'Select member'}
        mode={multiple ? 'multiple' : undefined}
        optionFilterProp="label"
        options={memberOptions}
      />
    </Form.Item>
  );
}
