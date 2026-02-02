# /component

Scaffold a React component following project patterns.

## Usage
`/component <name>` - Create component (e.g., `/component UserCard`)
`/component <folder>/<name>` - Create in specific folder

## Instructions

Create component file at `imports/ui/<folder>/<Name>.jsx`:

```javascript
import PropTypes from 'prop-types';
import React from 'react';

export default function <Name>({ prop1 = '', prop2 = [] }) {
  return (
    <div>
      {/* Component content */}
    </div>
  );
}

<Name>.propTypes = {
  prop1: PropTypes.string,
  prop2: PropTypes.array,
};
```

## Patterns

### With Meteor Data
```javascript
import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import PropTypes from 'prop-types';
import React, { useMemo } from 'react';
import Collection from '../../api/collections/<name>.collection';

export default function <Name>({ filter = {} }) {
  useSubscribe('<collection>', filter, { limit: 20 });
  const data = useFind(() => Collection.find(filter), [filter]);

  return (
    <div>
      {data.map(item => (
        <div key={item._id}>{item.name}</div>
      ))}
    </div>
  );
}

<Name>.propTypes = {
  filter: PropTypes.object,
};
```

### With Event Handlers
```javascript
import { App } from 'antd';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';

export default function <Name>({ onSuccess = () => {} }) {
  const { notification, message } = App.useApp();

  const handleClick = useCallback(async () => {
    try {
      await Meteor.callAsync('<collection>.method', args);
      message.success('Success');
      onSuccess();
    } catch (error) {
      notification.error({ message: error.error, description: error.message });
    }
  }, [onSuccess, message, notification]);

  return (
    <button onClick={handleClick}>Click</button>
  );
}

<Name>.propTypes = {
  onSuccess: PropTypes.func,
};
```

## Guidelines

- Function components only
- PropTypes required for all props
- Destructure props with defaults
- Use `useCallback` for event handlers
- Use `useMemo` for computed values
- Use Ant Design components for UI
