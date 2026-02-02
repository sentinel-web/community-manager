# /collection

Scaffold a new MongoDB collection with all required files and registrations.

## Usage
`/collection <name>` - Create collection (e.g., `/collection announcements`)

## Instructions

Follow these steps to create a complete collection:

### 1. Create Collection File

Create `imports/api/collections/<name>.collection.js`:

```javascript
import { Mongo } from 'meteor/mongo';

const <Name>Collection = new Mongo.Collection('<name>');

export default <Name>Collection;
```

### 2. Register in crud.lib.js

Add import at top of `server/crud.lib.js`:
```javascript
import <Name>Collection from '../imports/api/collections/<name>.collection';
```

Add case to `getCollection()` switch:
```javascript
case '<name>':
  return <Name>Collection;
```

Add at bottom with other registrations:
```javascript
createCollectionMethods('<name>');
createCollectionPublish('<name>');
```

### 3. Add Permission Mapping

In `server/main.js`, add to `COLLECTION_TO_MODULE`:
```javascript
<name>: '<name>',  // or map to existing module
```

If new permission module, add to `CRUD_MODULES` array:
```javascript
const CRUD_MODULES = [
  // ... existing modules
  '<name>',
];
```

### 4. Update CLAUDE.md

Add the new collection to the Collections list.

## Naming Conventions

- Collection name: camelCase singular or plural as appropriate (e.g., `announcements`)
- Collection variable: PascalCase + "Collection" (e.g., `AnnouncementsCollection`)
- File name: camelCase + `.collection.js` (e.g., `announcements.collection.js`)

## Output

After scaffolding, suggest creating:
- Form component with `/form <name>`
- Section page with `/section <name>`
