# /collection

Scaffold a new MongoDB collection with all required files and registrations.

## Usage
`/collection <name>` — create collection (e.g., `/collection announcements`)

> This codebase is **fully TypeScript (`strict: true`)**. Every file below is `.ts`/`.tsx`.
> Before writing, read the live shapes you must extend — do not trust a frozen template:
> - `imports/api/types/crud.ts` — the `CrudCollectionMap` interface (source of the `CrudCollectionName` union)
> - `server/collection-registry.ts` — `CollectionRegistryEntry` and the `COLLECTION_REGISTRY` map
> - `server/crud.lib.ts` — the `COLLECTIONS` map and `getCollection()`
> - `server/main.ts` — the `collectionNames` array (drives method/publish registration)
> - an existing collection, e.g. `imports/api/collections/squads.collection.ts`

## Steps

### 1. Define the document type

Add an interface in `imports/api/types/` (e.g. `imports/api/types/<name>.ts`) and re-export it from `imports/api/types/index.ts`. Mirror an existing type such as `squad.ts`.

### 2. Create the collection file

`imports/api/collections/<name>.collection.ts`:

```typescript
import { Mongo } from 'meteor/mongo';
import type { <Type> } from '/imports/api/types';

const <Name>Collection = new Mongo.Collection<<Type>>('<name>');

export default <Name>Collection;
```

### 3. Add to the `CrudCollectionMap`

In `imports/api/types/crud.ts`, add the entry **alphabetically** (this extends the `CrudCollectionName` union and makes a `COLLECTION_REGISTRY` entry compile-mandatory):

```typescript
export interface CrudCollectionMap {
  // ...
  <name>: <Type>;
}
```

### 4. Register in `server/crud.lib.ts`

Import the collection and add it to the `COLLECTIONS` map **alphabetically**:

```typescript
import <Name>Collection from '../imports/api/collections/<name>.collection';
// ...
const COLLECTIONS: CollectionMap = {
  // ...
  <name>: <Name>Collection,
};
```

### 5. Register methods + publication in `server/main.ts`

Add `'<name>'` to the `collectionNames` array **alphabetically**. The boot loop calls `createCollectionPublish()` + `createCollectionMethods()` for every entry. (Use `methodOnlyCollections` instead if the collection should expose methods but no reactive publication.)

### 6. Add the `COLLECTION_REGISTRY` entry

In `server/collection-registry.ts`, add **alphabetically** (minimum `{ module }`; add `foreignKeys`, `displayField`, `redact`, `allowsAnonymous` as needed — see `CollectionRegistryEntry`):

```typescript
<name>: { module: '<module>' },
```

If `<module>` is a new permission module, also add it to the CRUD-modules list in `server/main.ts`.

### 7. Update docs

Add the collection to the Collections list in `CLAUDE.md` and to `docs/collections.md`.

## Naming conventions

- Collection name (DDP + map keys): camelCase (e.g. `announcements`, `taskStatus`)
- Variable: PascalCase + `Collection` (e.g. `AnnouncementsCollection`)
- File: `<name>.collection.ts`

## Verify

- `npm run typecheck` (the `Record<CrudCollectionName, _>` registry will fail to compile if step 6 is skipped)
- `npm run lint`

## Next

- `/form <name>` — drawer form
- `/section <name>` — full CRUD page
