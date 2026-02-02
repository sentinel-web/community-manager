# /form

Scaffold an Ant Design form component with drawer integration.

## Usage
`/form <name>` - Create form (e.g., `/form Announcements`)

## Instructions

Create form file at `imports/ui/<name>/<Name>Form.jsx`:

```javascript
import { Form, Input } from 'antd';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useContext, useMemo } from 'react';
import { DrawerContext, SubdrawerContext } from '../app/App';
import FormFooter from '../components/FormFooter';

export default function <Name>Form({ setOpen, useSubdrawer = false }) {
  const drawer = useContext(DrawerContext);
  const subdrawer = useContext(SubdrawerContext);

  const model = useMemo(() => {
    return useSubdrawer ? subdrawer.drawerModel || {} : drawer.drawerModel || {};
  }, [drawer, subdrawer, useSubdrawer]);

  const handleFinish = async values => {
    const args = [...(model?._id ? [model._id] : []), values];
    const method = model?._id ? '<collection>.update' : '<collection>.insert';

    Meteor.callAsync(method, ...args)
      .then(() => {
        setOpen(false);
      })
      .catch(error => {
        console.error(error);
      });
  };

  return (
    <Form layout="vertical" initialValues={model} onFinish={handleFinish}>
      <Form.Item
        label="Name"
        name="name"
        rules={[{ required: true, type: 'string' }]}
        required
      >
        <Input placeholder="Enter name" />
      </Form.Item>

      {/* Add more Form.Item components as needed */}

      <FormFooter />
    </Form>
  );
}

<Name>Form.propTypes = {
  setOpen: PropTypes.func,
  useSubdrawer: PropTypes.bool,
};
```

## Common Form Fields

### Text Input
```javascript
<Form.Item label="Label" name="fieldName" rules={[{ required: true }]}>
  <Input placeholder="Enter value" />
</Form.Item>
```

### TextArea
```javascript
<Form.Item label="Description" name="description">
  <Input.TextArea rows={4} placeholder="Enter description" />
</Form.Item>
```

### Select
```javascript
<Form.Item label="Type" name="type" rules={[{ required: true }]}>
  <Select placeholder="Select type">
    <Select.Option value="a">Option A</Select.Option>
    <Select.Option value="b">Option B</Select.Option>
  </Select>
</Form.Item>
```

### CollectionSelect
```javascript
<CollectionSelect
  name="memberId"
  label="Member"
  rules={[{ required: true }]}
  collection={MembersCollection}
  subscription="members"
  FormComponent={MembersForm}
  placeholder="Select member"
/>
```

### Date Picker
```javascript
<Form.Item label="Date" name="date">
  <DatePicker style={{ width: '100%' }} />
</Form.Item>
```

### Switch
```javascript
<Form.Item label="Active" name="active" valuePropName="checked">
  <Switch />
</Form.Item>
```

## Guidelines

- Always use `layout="vertical"`
- Get model from DrawerContext or SubdrawerContext
- Handle both create (no _id) and update (has _id) modes
- Use FormFooter component for submit/cancel buttons
