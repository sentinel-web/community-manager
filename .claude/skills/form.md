# /form

Scaffold an Ant Design drawer form component.

## Usage
`/form <name>` — create form (e.g., `/form Announcements`)

> Fully TypeScript, `strict: true`. Forms run inside the **DrawerStack** and submit through
> the **`useEntityForm`** hook (the MethodCall seam) — there is no `setOpen`, `useSubdrawer`,
> `DrawerContext`, or `SubdrawerContext` anymore, and no raw `Meteor.callAsync` in forms.
> Read the live contract before writing:
> - `imports/ui/hooks/useEntityForm.ts` — `UseEntityFormOptions` / `UseEntityForm`
> - `imports/ui/components/FormFooter.tsx`
> - a real form, e.g. `imports/ui/squads/SquadsForm.tsx`

Create the form at `imports/ui/<name>/<Name>Form.tsx`:

```tsx
import { Form, Input } from 'antd';
import React from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';
import type { <Type> } from '../../api/types';
import useEntityForm from '../hooks/useEntityForm';
import FormFooter from '../components/FormFooter';

interface <Name>FormValues {
  name?: string;
}

const <Name>Form = () => {
  const { t } = useTranslation();

  // useEntityForm derives <name>.insert / <name>.update from `collection`,
  // reads the model from the drawer frame, and resolves the frame on success.
  const { onFinish, loading, model } = useEntityForm<<Name>FormValues, Partial<<Type>> & { _id?: string }>({
    collection: '<name>',
    created: 'messages.<name>Created',
    updated: 'messages.<name>Updated',
    // toPayload maps antd values to the wire payload — omit if a 1:1 mapping.
  });

  return (
    <Form layout="vertical" initialValues={model} onFinish={onFinish} disabled={loading}>
      <Form.Item label={t('common.name')} name="name" rules={[{ required: true, type: 'string' }]} required>
        <Input placeholder={t('forms.placeholders.enterName')} />
      </Form.Item>

      {/* more Form.Item fields */}

      <FormFooter loading={loading} />
    </Form>
  );
};

export default <Name>Form;
```

Add the `messages.<name>Created` / `messages.<name>Updated` keys to `imports/i18n/translations.ts` (all three locales).

## Common fields

### TextArea
```tsx
<Form.Item label={t('common.description')} name="description" rules={[{ required: false, type: 'string' }]}>
  <Input.TextArea autoSize placeholder={t('forms.placeholders.enterDescription')} />
</Form.Item>
```

### Switch / Checkbox — **must** set `valuePropName="checked"`
```tsx
<Form.Item label={t('...')} name="active" valuePropName="checked">
  <Switch />
</Form.Item>
```

### CollectionSelect (FK field with inline create/edit)
```tsx
<CollectionSelect
  name="memberId"
  label={t('...')}
  rules={[{ required: true }]}
  collection={MembersCollection}
  subscription="members"
  FormComponent={MembersForm}
/>
```

### Date
```tsx
<Form.Item label={t('...')} name="date">
  <DatePicker style={{ width: '100%' }} />
</Form.Item>
```

## Guidelines

- Always `layout="vertical"`; `initialValues={model}`; `disabled={loading}`.
- The model comes from `useEntityForm` (it reads the drawer frame) — never from a context or prop.
- `useEntityForm` handles both create (no `_id`) and update (has `_id`) automatically.
- Use `FormFooter` (`loading`, and `onCancel`/`onFinish` as needed) for the action buttons.
- Component is a plain function component — **no `React.FC`, no PropTypes** (lint-enforced).
- For nullable string fields, convert with `?? undefined` **only** at the antd DOM boundary, never on the write path.
