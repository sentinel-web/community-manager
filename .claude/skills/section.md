# /section

Scaffold a full Section page with collection, form, columns, and page component.

## Usage
`/section <name>` - Create full section (e.g., `/section announcements`)

## Instructions

This creates a complete CRUD section with:
1. Collection (if not exists)
2. Form component
3. Section page with columns

### 1. Create Folder Structure

```
imports/ui/<name>/
  ├── <Name>Form.jsx
  ├── <Name>Page.jsx
  └── <Name>Select.jsx (optional)
```

### 2. Create Page Component

`imports/ui/<name>/<Name>Page.jsx`:

```javascript
import React, { useCallback } from 'react';
import <Name>Collection from '../../api/collections/<name>.collection';
import Section from '../section/Section';
import <Name>Form from './<Name>Form';

function filterFactory(searchString) {
  return { name: { $regex: searchString, $options: 'i' } };
}

function columnsFactory(handleEdit, handleDelete, permissions) {
  return [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    // Add more columns as needed
    {
      title: 'Actions',
      dataIndex: 'actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          {permissions.canUpdate && (
            <Button type="link" onClick={e => handleEdit(e, record)}>
              Edit
            </Button>
          )}
          {permissions.canDelete && (
            <Popconfirm
              title="Delete this entry?"
              onConfirm={e => handleDelete(e, record)}
            >
              <Button type="link" danger>Delete</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];
}

export default function <Name>Page() {
  return (
    <Section
      title="<Display Name>"
      collectionName="<name>"
      Collection={<Name>Collection}
      FormComponent={<Name>Form}
      filterFactory={filterFactory}
      columnsFactory={columnsFactory}
      permissionModule="<name>"
    />
  );
}
```

### 3. Create Form Component

Use `/form <name>` to generate the form.

### 4. Register Collection

Use `/collection <name>` if collection doesn't exist.

### 5. Add Navigation

Add to navigation in `imports/ui/navigation/` to make the page accessible.

## Column Examples

### Text Column
```javascript
{ title: 'Name', dataIndex: 'name', key: 'name' }
```

### Date Column
```javascript
{
  title: 'Date',
  dataIndex: 'date',
  key: 'date',
  render: date => date ? new Date(date).toLocaleDateString() : '-',
}
```

### Boolean Column
```javascript
{
  title: 'Active',
  dataIndex: 'active',
  key: 'active',
  render: active => active ? 'Yes' : 'No',
}
```

### Reference Column
```javascript
{
  title: 'Member',
  dataIndex: 'memberId',
  key: 'memberId',
  render: memberId => {
    const member = useTracker(() => MembersCollection.findOne(memberId), [memberId]);
    return member?.profile?.name || '-';
  },
}
```

## Guidelines

- Use Section component for standard CRUD pages
- Define filterFactory for search functionality
- Define columnsFactory with permission-aware actions
- Set permissionModule to control access
