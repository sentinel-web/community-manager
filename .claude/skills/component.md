# /component

Scaffold a React component following project patterns.

## Usage
`/component <name>` — create component (e.g., `/component UserCard`)
`/component <folder>/<name>` — create in a specific folder

> Fully TypeScript, `strict: true`. **Function components only — no `React.FC`, no PropTypes.**
> Props are a TypeScript `interface` declared **above** the component. Mirror an existing
> component such as `imports/ui/squads/SquadMembers.tsx`.

Create the component at `imports/ui/<folder>/<Name>.tsx`:

```tsx
import React from 'react';

interface <Name>Props {
  prop1?: string;
  prop2?: string[];
}

export default function <Name>({ prop1 = '', prop2 = [] }: <Name>Props) {
  return <div>{/* content */}</div>;
}
```

## Patterns

### With Meteor data

```tsx
import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import React from 'react';
import <Name>Collection from '../../api/collections/<name>.collection';
import type { <Type> } from '../../api/types';

interface <Name>Props {
  filter?: Record<string, unknown>;
}

export default function <Name>({ filter = {} }: <Name>Props) {
  useSubscribe('<name>', filter, { limit: 20 });
  const data = useFind(() => <Name>Collection.find(filter), [filter]);

  return (
    <div>
      {data.map((item: <Type>) => (
        <div key={item._id}>{item.name}</div>
      ))}
    </div>
  );
}
```

### With a method call

Prefer the `useMethod` hook (the MethodCall seam) over a raw `Meteor.callAsync`. Get
`message`/`notification` from `App.useApp()` — never the static antd singletons (they
don't render inside drawer context).

```tsx
import { App } from 'antd';
import React, { useCallback } from 'react';
import useMethod from '../hooks/useMethod';

interface <Name>Props {
  onSuccess?: () => void;
}

export default function <Name>({ onSuccess = () => {} }: <Name>Props) {
  const { message } = App.useApp();
  const { call, loading } = useMethod('<name>.method');

  const handleClick = useCallback(async () => {
    const res = await call(/* args */);
    if (res.ok) {
      message.success('Success');
      onSuccess();
    } else {
      message.error(res.error.message);
    }
  }, [call, message, onSuccess]);

  return <button onClick={handleClick} disabled={loading}>Click</button>;
}
```

## Guidelines

- Function components only; **no `React.FC`** (these are lint-enforced — see `eslint.config.mjs`).
- Props interface named `<Name>Props`, declared above the component; destructure with defaults in the signature.
- **No PropTypes** — the codebase is TypeScript.
- `useCallback` for event handlers, `useMemo` for computed values; narrow dependency arrays to specific fields.
- Use Ant Design components; use `useTranslation()` (`t()`) for user-facing strings.
- On `member.profile.X` access use a non-null assertion (`member.profile.X`), never optional chaining.
