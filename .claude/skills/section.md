# /section

Scaffold a full Section page: collection, form, typed columns, and the page component.

## Usage
`/section <name>` — create a full CRUD section (e.g., `/section announcements`)

> Fully TypeScript, `strict: true`. The generic `Section<T>` component drives the table,
> search, and drawer. Read the live contract and a real example before writing:
> - `imports/ui/section/types.ts` — `ColumnsFactory`, `SectionPermissions`, `RowClickEvent`, `TranslateFn`
> - `imports/ui/squads/Squads.tsx` (page), `imports/ui/squads/squads.columns.tsx` (columns)

## Steps

### 1. Collection — `/collection <name>`
If the collection doesn't exist yet, scaffold it first.

### 2. Folder structure
```
imports/ui/<name>/
  ├── <Name>.tsx           # the page (renders <Section<T>>)
  ├── <Name>Form.tsx       # /form <name>
  ├── <name>.columns.tsx   # ColumnsFactory<T>
  └── <Name>Select.tsx     # optional, for FK selection elsewhere
```

### 3. Columns — `imports/ui/<name>/<name>.columns.tsx`

```tsx
import type { ColumnsType } from 'antd/es/table';
import React from 'react';
import type { <Type> } from '../../api/types';
import type { ColumnsFactory, RowClickEvent, SectionPermissions, TranslateFn } from '../section/types';
import TableActions from '../table/body/actions/TableActions';

const defaultPermissions: SectionPermissions = { canCreate: true, canUpdate: true, canDelete: true };

const get<Name>Columns: ColumnsFactory<<Type>> = (
  handleEdit: (e: RowClickEvent, record: <Type>) => void,
  handleDelete: (e: RowClickEvent, record: <Type>) => void,
  permissions: SectionPermissions = defaultPermissions,
  t: TranslateFn
) => {
  const { canUpdate = true, canDelete = true } = permissions;

  const columns: ColumnsType<<Type>> = [
    {
      title: t('common.name'),
      dataIndex: 'name',
      key: 'name',
      sorter: (a: <Type>, b: <Type>) => String(a.name).localeCompare(String(b.name)),
      render: (name: string | undefined) => name || '-',
    },
  ];

  if (canUpdate || canDelete) {
    columns.push({
      title: t('common.actions'),
      dataIndex: 'actions',
      key: 'actions',
      render: (_id: unknown, record: <Type>) => (
        <TableActions record={record} handleEdit={handleEdit} handleDelete={handleDelete} canUpdate={canUpdate} canDelete={canDelete} />
      ),
    });
  }

  return columns;
};

export default get<Name>Columns;
```

### 4. Page — `imports/ui/<name>/<Name>.tsx`

```tsx
import React from 'react';
import type { <Type> } from '../../api/types';
import <Name>Collection from '../../api/collections/<name>.collection';
import { useTranslation } from '../../i18n/LanguageContext';
import Section from '../section/Section';
import <Name>Form from './<Name>Form';
import get<Name>Columns from './<name>.columns';

export default function <Name>() {
  const { t } = useTranslation();
  return (
    <Section<<Type>>
      title={t('<name>.title')}
      collectionName="<name>"
      Collection={<Name>Collection}
      FormComponent={<Name>Form}
      columnsFactory={get<Name>Columns}
    />
  );
}
```

If the permission module differs from the collection name, pass `permissionModule="<module>"`.

### 5. Form — `/form <name>`

### 6. Navigation
Register the page in `imports/ui/navigation/` so it's reachable, and add its i18n keys to `imports/i18n/translations.ts`.

## Column examples

### Date
```tsx
{ title: t('columns.date'), dataIndex: 'date', key: 'date',
  render: (date: Date | undefined) => (date ? new Date(date).toLocaleDateString() : '-') }
```

### Color tag — preserve the color render (`color || 'transparent'`, never `?? undefined`)
```tsx
{ title: t('common.color'), dataIndex: 'color', key: 'color',
  render: (color: string | undefined) => <Tag color={color || 'transparent'}>{color || '-'}</Tag> }
```

## Guidelines

- Use the `Section<T>` generic for standard CRUD pages.
- Columns live in a `ColumnsFactory<T>` whose signature is `(handleEdit, handleDelete, permissions, t)`.
- Use `TableActions` for the permission-aware edit/delete buttons.
- Plain function components — **no `React.FC`, no PropTypes** (lint-enforced).
