# TypeScript Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Community Manager codebase (149 `.js`/`.jsx` files across `imports/`, `server/`, `client/`) from JavaScript with PropTypes to TypeScript, without a feature freeze, delivering incremental type-safety improvements that can be shipped after each milestone.

**Architecture:** Incremental migration with `allowJs: true` in `tsconfig.json` — new and touched files become `.ts`/`.tsx`, untouched files stay JS. Collection schema types are defined first and become the ground truth shared across client and server. The CRUD factory (`server/crud.lib.js`) uses mapped types over a collection-name registry so `Meteor.callAsync('medals.insert', ...)` gets typed at call sites. PropTypes remain while a file is `.jsx`; they are removed when the file is converted to `.tsx`.

**Tech Stack:** TypeScript 5.9.3 (already in `.meteor/packages`), Meteor 3.4+, React 18, Ant Design 5, MongoDB via `meteor/mongo`. Existing E2E tests in `e2e/` are already TypeScript — their patterns are reusable.

**Effort estimate:** 40–60 hours total, split across 8 milestones. Each milestone is shippable independently and merges to `main` before the next starts.

**Prior work to know about (this repo):**
- `jsconfig.json` exists with path aliases (`/imports/*`) — will be replaced by `tsconfig.json`
- `server/main.js` exports validators (`validateString`, etc.), permission helpers (`checkPermission`), role cache — widely imported
- `server/crud.lib.js` is a factory that generates `*.read/insert/update/remove/count/options` methods for 16 registered collections
- `imports/api/collections/*.collection.js` — 19 plain `Mongo.Collection` exports, no schemas
- `tests/server/fixtures.js` (new) provides `callAs`, `createTestRole`, etc. — keep working throughout migration
- Audit logs store data under `log.payload`, not `log.data` (see commit `47dfa4d`)

---

## Milestone 1 — Foundation (tsconfig + global types)

**Deliverable:** `tsconfig.json` configured for incremental migration, `meteor test` + `meteor run` still pass, no code migrated yet but future `.ts`/`.tsx` files are type-checked.

**Estimate:** 2–3 hours.

### Task 1.1: Create `tsconfig.json`

**Files:**
- Create: `tsconfig.json`
- Modify: `package.json` (add `typecheck` script)

- [ ] **Step 1: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "jsx": "react",
    "allowJs": true,
    "checkJs": false,
    "strict": false,
    "noImplicitAny": false,
    "strictNullChecks": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "/*": ["./*"],
      "/imports/*": ["./imports/*"],
      "meteor/*": [".meteor/local/types/packages.d.ts"]
    },
    "types": ["node"]
  },
  "include": ["imports/**/*", "server/**/*", "client/**/*", ".meteor/local/types/**/*.d.ts"],
  "exclude": ["node_modules", ".meteor/local", "e2e", "dist", "build"]
}
```

**Rationale for each non-default flag:**
- `allowJs + checkJs: false` — co-existence with unmigrated JS
- `strict: false, strictNullChecks: true` — null safety is the highest-value rule; fuller strict mode lands in Milestone 8
- `noImplicitAny: false` — allows gradual typing of JS files without flood of errors
- `isolatedModules: true` — ensures each file is independently transpilable (required by Meteor's bundler)
- `noEmit: true` — Meteor handles compilation; `tsc` only type-checks

- [ ] **Step 2: Add typecheck script to `package.json`**

```json
"scripts": {
  "typecheck": "tsc --noEmit -p tsconfig.json"
}
```

- [ ] **Step 3: Delete `jsconfig.json`**

```bash
rm jsconfig.json
```

- [ ] **Step 4: Run typecheck to confirm clean baseline**

Run: `npm run typecheck`
Expected: exit 0, no errors (no `.ts` files yet).

- [ ] **Step 5: Run tests to confirm build still works**

Run: `npm test`
Expected: `168 passing`.

- [ ] **Step 6: Commit**

```bash
git add tsconfig.json package.json
git rm jsconfig.json
git commit -m "build: add tsconfig.json for incremental TypeScript migration"
```

### Task 1.2: Add shared ambient declarations

**Files:**
- Create: `imports/types/meteor-globals.d.ts`
- Create: `imports/types/env.d.ts`

- [ ] **Step 1: Write `imports/types/meteor-globals.d.ts`**

```typescript
// Ambient declarations for Meteor types that aren't cleanly exposed
// by the auto-generated `.meteor/local/types/packages.d.ts`.

import type { Mongo } from 'meteor/mongo';

declare global {
  namespace Meteor {
    interface User {
      _id: string;
      username?: string;
      profile?: import('/imports/api/types/member').MemberProfile;
      createdAt?: Date;
    }
  }
}

export {};
```

- [ ] **Step 2: Write `imports/types/env.d.ts`**

```typescript
// Meteor build-time env var access patterns used in this codebase.
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV?: 'development' | 'production' | 'test';
    ROOT_URL?: string;
    MONGO_URL?: string;
    PORT?: string;
    METEOR_SETTINGS?: string;
  }
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: exit 0. (`Meteor.User` is referenced by `imports/api/types/member` which does not exist yet — this task intentionally leaves a dangling import. It gets fixed in Task 2.1, and typecheck is run again there.)

**Note:** If Meteor's bundler errors on the missing module, replace the `profile` line with `profile?: Record<string, unknown>;` as a temporary stub until Task 2.1 lands.

- [ ] **Step 4: Commit**

```bash
git add imports/types/
git commit -m "build: add ambient type declarations for meteor globals and env"
```

---

## Milestone 2 — Collection Schema Types

**Deliverable:** All 19 collections have TypeScript interfaces describing their documents. Collection files (`imports/api/collections/*.collection.js`) migrate to `.ts` and use `Mongo.Collection<DocType>`. Nothing else changes yet.

**Estimate:** 3–4 hours.

### Task 2.1: Create `imports/api/types/` directory with schemas

**Files:**
- Create: `imports/api/types/member.ts`
- Create: `imports/api/types/event.ts`
- Create: `imports/api/types/task.ts`
- Create: `imports/api/types/squad.ts`
- Create: `imports/api/types/rank.ts`
- Create: `imports/api/types/role.ts`
- Create: `imports/api/types/questionnaire.ts`
- Create: `imports/api/types/shared.ts` (common types: colored entity, ID references)
- Create: `imports/api/types/index.ts` (barrel export)

- [ ] **Step 1: Write `imports/api/types/shared.ts`**

```typescript
export type MemberId = string;
export type RoleId = string;
export type EventId = string;

export interface ColoredEntity {
  _id?: string;
  name: string;
  color?: string;
  description?: string;
}

export type AttendanceStatus = -2 | -1 | 0 | 1 | 2;

export interface Attendances {
  [eventId: string]: {
    [memberId: string]: AttendanceStatus;
  };
}
```

- [ ] **Step 2: Write `imports/api/types/member.ts`** — base all other schemas on the project's existing CLAUDE.md field list.

```typescript
import type { MemberId } from './shared';

export interface MemberProfile {
  name?: string;
  id?: number;
  roleId?: string;
  squadId?: string;
  rankId?: string;
  navyRankId?: string;
  specializationIds?: string[];
  medalIds?: string[];
  profilePictureId?: string;
  discordTag?: string;
  steamProfileLink?: string;
  description?: string;
  entryDate?: Date;
  exitDate?: Date;
  staticAttendancePoints?: number;
  staticInactivityPoints?: number;
  hasCustomArmour?: boolean;
}

export interface Member {
  _id: MemberId;
  username?: string;
  profile?: MemberProfile;
  createdAt?: Date;
}
```

- [ ] **Step 3: Write `imports/api/types/event.ts`**

```typescript
import type { EventId, MemberId } from './shared';

export interface EventDoc {
  _id?: EventId;
  name: string;
  start: Date;
  end: Date;
  eventType?: string;
  hosts?: MemberId[];
  attendees?: MemberId[];
  isPrivate?: boolean;
  color?: string;
  preset?: string;
  description?: string;
  rrule?: string;
}
```

- [ ] **Step 4: Write `imports/api/types/task.ts`**

```typescript
import type { MemberId } from './shared';

export type TaskPriority = 'low' | 'medium' | 'high';

export interface Task {
  _id?: string;
  name: string;
  status?: string; // taskStatusId
  participants?: MemberId[];
  priority?: TaskPriority;
  link?: string;
  description?: string;
  parent?: string; // parent task _id
  createdAt?: Date;
}
```

- [ ] **Step 5: Write `imports/api/types/squad.ts`**

```typescript
export interface Squad {
  _id?: string;
  name: string;
  color?: string;
  image?: string; // base64
  parentSquadId?: string;
  shortRangeFrequency?: string;
  longRangeFrequency?: string;
  description?: string;
}
```

- [ ] **Step 6: Write `imports/api/types/rank.ts`**

```typescript
export type RankType = 'player' | 'zeus';

export interface Rank {
  _id?: string;
  name: string;
  type: RankType;
  color?: string;
  previousRankId?: string;
  nextRankId?: string;
  description?: string;
}
```

- [ ] **Step 7: Write `imports/api/types/role.ts`**

```typescript
export interface CrudPermission {
  read?: boolean;
  create?: boolean;
  update?: boolean;
  delete?: boolean;
}

// `roles: true` is the admin flag and is handled separately from the CRUD object.
export interface Role {
  _id?: string;
  name: string;
  color?: string;
  description?: string;
  roles?: boolean | CrudPermission;
  dashboard?: boolean;
  orbat?: boolean;
  logs?: boolean;
  settings?: boolean;
  members?: boolean | CrudPermission;
  events?: boolean | CrudPermission;
  tasks?: boolean | CrudPermission;
  squads?: boolean | CrudPermission;
  ranks?: boolean | CrudPermission;
  specializations?: boolean | CrudPermission;
  medals?: boolean | CrudPermission;
  eventTypes?: boolean | CrudPermission;
  taskStatus?: boolean | CrudPermission;
  registrations?: boolean | CrudPermission;
  discoveryTypes?: boolean | CrudPermission;
  positions?: boolean | CrudPermission;
  questionnaires?: boolean | CrudPermission;
  canCreateEvents?: boolean;
  canManageTasks?: boolean;
  canManageSpecializations?: boolean;
  canManageRecruits?: boolean;
}
```

- [ ] **Step 8: Write `imports/api/types/questionnaire.ts`**

```typescript
import type { MemberId } from './shared';

export type QuestionType = 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'rating';
export type QuestionnaireStatus = 'draft' | 'active' | 'closed';
export type QuestionnaireInterval = 'once' | 'daily' | 'weekly' | 'monthly' | 'unlimited';

export interface Question {
  text: string;
  type: QuestionType;
  required?: boolean;
  options?: string[];
}

export interface Questionnaire {
  _id?: string;
  name: string;
  description?: string;
  status: QuestionnaireStatus;
  allowAnonymous?: boolean;
  interval: QuestionnaireInterval;
  questions: Question[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Answer {
  questionIndex: number;
  questionText: string;
  questionType: QuestionType;
  value: unknown;
}

export interface QuestionnaireResponse {
  _id?: string;
  questionnaireId: string;
  respondentId: MemberId | null;
  answers: Answer[];
  ignored?: boolean;
  submittedAt?: Date;
  createdAt?: Date;
}
```

- [ ] **Step 9: Write simple schemas for remaining 10 collections in a single file `imports/api/types/misc.ts`**

```typescript
import type { ColoredEntity } from './shared';

export type Medal = ColoredEntity;
export type EventType = ColoredEntity;
export type TaskStatus = ColoredEntity;
export type DiscoveryType = ColoredEntity;
export type Position = ColoredEntity;

export interface Specialization extends ColoredEntity {
  linkToFile?: string;
  instructors?: string[];
  requiredSpecializations?: string[];
  requiredRankId?: string;
}

export interface Registration {
  _id?: string;
  name: string;
  id: number;
  age: number;
  discoveryType?: string;
  rulesReadAndAccepted: boolean;
  description?: string;
}

export interface ProfilePicture {
  _id?: string;
  value: string; // base64
}

export interface SettingDoc {
  _id?: string;
  key: string;
  value: unknown;
}

export interface LogEntry {
  _id?: string;
  action: string;
  payload?: Record<string, unknown>;
  timestamp?: Date;
  createdAt: Date;
}
```

- [ ] **Step 10: Write barrel `imports/api/types/index.ts`**

```typescript
export * from './shared';
export * from './member';
export * from './event';
export * from './task';
export * from './squad';
export * from './rank';
export * from './role';
export * from './questionnaire';
export * from './misc';
```

- [ ] **Step 11: Run typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 12: Commit**

```bash
git add imports/api/types/ imports/types/meteor-globals.d.ts
git commit -m "feat(types): add shared TypeScript interfaces for all 19 collections"
```

### Task 2.2: Migrate collection files to `.ts`

**Files:**
- Rename + rewrite: all 19 files in `imports/api/collections/*.collection.js` → `*.collection.ts`

- [ ] **Step 1: Migrate `medals.collection.js` → `medals.collection.ts` (template)**

```bash
git mv imports/api/collections/medals.collection.js imports/api/collections/medals.collection.ts
```

Write:
```typescript
import { Mongo } from 'meteor/mongo';
import type { Medal } from '/imports/api/types';

const MedalsCollection = new Mongo.Collection<Medal>('medals');

export default MedalsCollection;
```

- [ ] **Step 2: Apply the same pattern to the other 18 collections**

For each collection, the import path is `/imports/api/types` and the type parameter matches the interface name:

| File | Type |
|------|------|
| `attendances.collection.ts` | `Record<string, Record<string, AttendanceStatus>>` — use `Mongo.Collection<{ _id: string } & Attendances>` |
| `discoveryTypes.collection.ts` | `DiscoveryType` |
| `eventTypes.collection.ts` | `EventType` |
| `events.collection.ts` | `EventDoc` |
| `logs.collection.ts` | `LogEntry` |
| `members.collection.ts` | — skip, members uses `Meteor.users`, not a custom collection |
| `positions.collection.ts` | `Position` |
| `profilePictures.collection.ts` | `ProfilePicture` |
| `questionnaireResponses.collection.ts` | `QuestionnaireResponse` |
| `questionnaires.collection.ts` | `Questionnaire` |
| `ranks.collection.ts` | `Rank` |
| `registrations.collection.ts` | `Registration` |
| `roles.collection.ts` | `Role` |
| `settings.collection.ts` | `SettingDoc` |
| `specializations.collection.ts` | `Specialization` |
| `squads.collection.ts` | `Squad` |
| `taskStatus.collection.ts` | `TaskStatus` |
| `tasks.collection.ts` | `Task` |

**Important:** `members.collection.js` currently re-exports `Meteor.users`. Keep it as `.ts` but don't redefine the type — `Meteor.User` is already declared in `imports/types/meteor-globals.d.ts` (Task 1.2).

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: `168 passing`.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add imports/api/collections/
git commit -m "refactor(collections): migrate 19 collection files to TypeScript"
```

---

## Milestone 3 — Server Infrastructure

**Deliverable:** `server/main.ts`, `server/crud.lib.ts`, and the two smallest API files (`logs.server.ts`, `settings.server.ts`) are migrated. The CRUD factory has correct generics so call sites get typed method signatures.

**Estimate:** 6–8 hours. This is the hardest milestone due to `crud.lib.js` complexity.

### Task 3.1: Migrate `server/main.js` → `server/main.ts`

**Files:**
- Rename: `server/main.js` → `server/main.ts`
- Test: existing `tests/server/permissions.test.js`, `tests/server/validation.test.js`, `tests/server/getCollection.test.js`

- [ ] **Step 1: Rename file**

```bash
git mv server/main.js server/main.ts
```

- [ ] **Step 2: Add return types and parameter types to all exports**

Canonical signatures (from reading the current file):

```typescript
export function validateString(value: unknown, optional: boolean): void;
export function validateNumber(value: unknown, optional: boolean): void;
export function validateBoolean(value: unknown, optional: boolean): void;
export function validateDate(value: unknown, optional: boolean): void;
export function validateArray(value: unknown, optional: boolean): void;
export function validateArrayOfStrings(value: unknown, optional: boolean): void;
export function validateObject(value: unknown, optional: boolean): void;
export function validateUserId(userId: string | null): asserts userId is string;
export function validatePublish(userId: string | null, filter: unknown, options: unknown): void;

export function normalizeRolePermissions(role: Role | null | undefined): Role | null;
export function isOfficerOrAdmin(role: Role | null | undefined): boolean;
export function getPermissionModule(collectionName: string): string | null;
export async function checkPermission(userId: string, module: string, operation: 'read' | 'create' | 'update' | 'delete'): Promise<boolean>;
export async function checkSpecialPermission(userId: string, flag: string): Promise<boolean>;
export async function getSquadScope(userId: string): Promise<{ 'profile.squadId'?: string }>;
export function clearRoleCache(roleId?: string): void;

export const BOOLEAN_MODULES: readonly string[];
export const CRUD_MODULES: readonly string[];
```

Apply types in place. Keep all runtime logic unchanged.

- [ ] **Step 3: Add type guard annotation for validators**

Change `validateString` and siblings to be assertion functions where used as preconditions:
```typescript
export function validateString(value: unknown, optional: boolean): asserts value is string {
  // existing body unchanged
}
```
Skip for `validateObject` because its current throws-and-returns-undefined shape is called in `if (validateObject(...))` patterns in `crud.lib.js` — keep it as plain `void` for now. (The unreachable 400 branch noted in the `47dfa4d` commit is a cleanup for a future PR, not this one.)

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: `168 passing`.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add server/main.ts
git commit -m "refactor(server): migrate main.ts — validators, permissions, role cache"
```

### Task 3.2: Define the CRUD method registry type

**Files:**
- Create: `imports/api/types/crud.ts`

- [ ] **Step 1: Write the generic method-name → argument-type mapping**

```typescript
import type {
  Attendances, DiscoveryType, EventDoc, EventType, LogEntry, Medal,
  Position, ProfilePicture, Questionnaire, QuestionnaireResponse,
  Rank, Registration, Role, Specialization, Squad, Task, TaskStatus,
} from './index';

export interface CrudCollectionMap {
  attendances: Attendances;
  discoveryTypes: DiscoveryType;
  events: EventDoc;
  eventTypes: EventType;
  logs: LogEntry;
  medals: Medal;
  positions: Position;
  profilePictures: ProfilePicture;
  questionnaireResponses: QuestionnaireResponse;
  questionnaires: Questionnaire;
  ranks: Rank;
  registrations: Registration;
  roles: Role;
  specializations: Specialization;
  squads: Squad;
  taskStatus: TaskStatus;
  tasks: Task;
}

export type CrudCollectionName = keyof CrudCollectionMap;

// Auto-generated method names for each collection.
export type CrudMethodName =
  | `${CrudCollectionName}.read`
  | `${CrudCollectionName}.insert`
  | `${CrudCollectionName}.update`
  | `${CrudCollectionName}.remove`
  | `${CrudCollectionName}.bulkRemove`
  | `${CrudCollectionName}.count`
  | `${CrudCollectionName}.options`;

export interface SelectOption<T> {
  key: string;
  label: string;
  title: string;
  value: string;
  raw: T;
}
```

- [ ] **Step 2: Re-export from barrel**

Edit `imports/api/types/index.ts` to add:
```typescript
export * from './crud';
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add imports/api/types/crud.ts imports/api/types/index.ts
git commit -m "feat(types): add CRUD method-name registry for typed Meteor.callAsync"
```

### Task 3.3: Migrate `server/crud.lib.js` → `server/crud.lib.ts`

**Files:**
- Rename: `server/crud.lib.js` → `server/crud.lib.ts`
- Test: `tests/server/crudMethods.test.js` (already exists, must stay green)

- [ ] **Step 1: Rename file**

```bash
git mv server/crud.lib.js server/crud.lib.ts
```

- [ ] **Step 2: Type `getCollection` with a conditional return**

```typescript
import type { Mongo } from 'meteor/mongo';
import type { CrudCollectionMap, CrudCollectionName } from '/imports/api/types';

export function getCollection<K extends CrudCollectionName>(
  collection: K,
): Mongo.Collection<CrudCollectionMap[K]> {
  if (!collection) throw new Meteor.Error(400, 'No collection name');
  switch (collection) {
    // existing switch cases — cast return values to the mapped type
    case 'medals':
      return MedalsCollection as Mongo.Collection<CrudCollectionMap[K]>;
    // ... rest unchanged
    default:
      throw new Meteor.Error(404, `Collection "${collection}" not found`);
  }
}
```

The `as` cast is needed because TypeScript cannot narrow a switch over a generic. Acceptable trade-off — getCollection is the one place runtime collection lookup and type registry meet.

- [ ] **Step 3: Type the method-handler factory**

Add types to the `Meteor.methods` object generated by `createCollectionMethods`:

```typescript
function createCollectionMethods<K extends CrudCollectionName>(collection: K): void {
  // existing body — add types to payload, id, filter, options params
  // method handlers stay `async function(...)` so `this` is typed as MethodInvocation
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: `168 passing` (including the 21 crudMethods integration tests).

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add server/crud.lib.ts
git commit -m "refactor(server): migrate crud.lib.ts with generics over collection registry"
```

### Task 3.4: Migrate `logs.server.js` and `settings.server.js`

**Files:**
- Rename: `server/apis/logs.server.js` → `logs.server.ts`
- Rename: `server/apis/settings.server.js` → `settings.server.ts`

These two are the smallest API files and have no inter-API dependencies. They are the template for Milestone 4.

- [ ] **Step 1: Migrate `logs.server.ts`**

```bash
git mv server/apis/logs.server.js server/apis/logs.server.ts
```

Add parameter types to `createLog`:
```typescript
export async function createLog(action: string, payload: Record<string, unknown> = {}): Promise<string> {
  // body unchanged
}
```

- [ ] **Step 2: Migrate `settings.server.ts`** — same pattern.

- [ ] **Step 3: Run tests + typecheck**

Run: `npm test && npm run typecheck`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add server/apis/
git commit -m "refactor(server): migrate logs and settings APIs to TypeScript"
```

---

## Milestone 4 — Remaining Server APIs

**Deliverable:** All 14 remaining files in `server/apis/` are TypeScript with typed method arguments and return types.

**Estimate:** 5–8 hours (migrate in dependency order — leafs first, aggregators last).

**Recommended order:**
1. `registrations.server.ts` (independent, simple validators)
2. `specializations.server.ts` (independent)
3. `squads.server.ts`
4. `tasks.server.ts`
5. `members.server.ts` (depends on squads, permissions)
6. `events.server.ts` (depends on members)
7. `questionnaires.server.ts`
8. `questionnaireResponses.server.ts` (depends on questionnaires)
9. `orbat.server.ts` (depends on members, squads, ranks)
10. `dashboard.server.ts` (reads from many — migrate last among reads)
11. `backup.server.ts` (touches everything — migrate very last)
12. `demoData.server.ts` (seed data, migrate with backup)

**Per-file task template** (repeat for each):

### Task 4.N: Migrate `{file}.server.js`

- [ ] **Step 1: Rename**

```bash
git mv server/apis/{file}.server.js server/apis/{file}.server.ts
```

- [ ] **Step 2: Add types to exported functions and all `Meteor.methods` handler args**

Use types from `/imports/api/types/`. For inputs that are free-form objects, use `Record<string, unknown>` initially and tighten per-method as signatures stabilize.

- [ ] **Step 3: Run tests + typecheck**

Run: `npm test && npm run typecheck`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add server/apis/{file}.server.ts
git commit -m "refactor(server): migrate {file} API to TypeScript"
```

**Milestone 4 close commit:**
```bash
git commit -m "refactor(server): complete TypeScript migration of all server APIs"
```

---

## Milestone 5 — i18n, Helpers, and `server/config.js`

**Deliverable:** Everything outside `imports/ui/` and `server/apis/` is TypeScript.

**Estimate:** 2–3 hours.

### Task 5.1: Migrate `imports/i18n/`

**Files:**
- Rename: `imports/i18n/LanguageContext.jsx` → `LanguageContext.tsx`
- Rename: `imports/i18n/index.js` → `index.ts` (if it exists)
- Keep: `imports/i18n/locales/*.json` unchanged

- [ ] **Step 1: Type the language context**

```typescript
export type Locale = 'en' | 'de' | 'fr';

export interface LanguageContextValue {
  language: Locale;
  setLanguage: (lang: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  locales: Record<Locale, Record<string, string>>;
}
```

- [ ] **Step 2: Add JSON module declarations**

Create `imports/i18n/locales/locales.d.ts`:
```typescript
declare module '*.json' {
  const value: Record<string, string>;
  export default value;
}
```

- [ ] **Step 3: Run typecheck + tests**

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(i18n): migrate LanguageContext to TypeScript"
```

### Task 5.2: Migrate `imports/helpers/`

- [ ] **Step 1: Rename all `*.js` files in `imports/helpers/` (colors, date, etc.) to `.ts`**
- [ ] **Step 2: Add explicit return types to all exported functions**
- [ ] **Step 3: Update `tests/helpers/colors/*.test.js` imports if paths change** (shouldn't — extensions are resolved automatically)
- [ ] **Step 4: `npm test` — expect `168 passing`**
- [ ] **Step 5: Commit** `refactor(helpers): migrate helper functions to TypeScript`

### Task 5.3: Migrate `server/config.js` and `imports/config.js`

- [ ] **Step 1: Rename both to `.ts`**
- [ ] **Step 2: Add explicit types for the exported config objects**
- [ ] **Step 3: `npm test && npm run typecheck`**
- [ ] **Step 4: Commit** `refactor(config): migrate config files to TypeScript`

---

## Milestone 6 — UI Foundation (contexts, shared components, routing)

**Deliverable:** Everything in `imports/ui/` that is *not* a feature folder is TypeScript. Feature folders (events, members, tasks, etc.) still JS.

**Estimate:** 4–6 hours.

**Migrate these folders in order:**

### Task 6.1: Theme, Tour, Navigation contexts

**Files in scope:** `imports/ui/theme/`, `imports/ui/tour/`, `imports/ui/navigation/`

- [ ] **Step 1: Rename `.jsx` → `.tsx`**
- [ ] **Step 2: Type context values** (e.g. `ThemeContextValue = { dark: boolean; toggle: () => void }`)
- [ ] **Step 3: Remove PropTypes, replace with React.FC props interface**
- [ ] **Step 4: Run E2E smoke test** (`npm run e2e -- auth.spec.ts`) — theme + navigation are in the auth spec.
- [ ] **Step 5: Commit** `refactor(ui): migrate theme, tour, navigation contexts to TypeScript`

### Task 6.2: Reusable components (section, table, components, footer, header, logo)

**Files in scope:** `imports/ui/section/*.jsx` (2), `imports/ui/table/*.jsx` (6), `imports/ui/components/*.jsx` (3), `imports/ui/footer/*.jsx`, `imports/ui/header/*.jsx`, `imports/ui/logo/*.jsx`

**Per-component pattern:**

```typescript
interface SectionProps<T> {
  title: string;
  collectionName: string;
  columnsFactory: (handleEdit: (row: T) => void, handleDelete: (id: string) => void, permissions: CrudPermission, t: TranslateFn) => ColumnType<T>[];
  permissionModule?: string;
  // ... rest
}

export default function Section<T>({ title, collectionName, columnsFactory, permissionModule }: SectionProps<T>) {
  // body unchanged
}
```

- [ ] **Step 1: Migrate `Section` and `SectionCard` first (widest impact)**
- [ ] **Step 2: Migrate table family (`Table`, `TableHeader`, `TableFooter`, `TableContainer`, `table.columns`, etc.)**
- [ ] **Step 3: Migrate `CollectionSelect`, `FormFooter`, `ReactTarget`**
- [ ] **Step 4: Migrate layout widgets: `Footer`, `Header`, `Logo`, `Title`**
- [ ] **Step 5: Run full E2E suite** (`npm run e2e`) — these components are in every page; a regression would show up broadly.
- [ ] **Step 6: Commit** `refactor(ui): migrate shared components to TypeScript`

### Task 6.3: App shell (`App.jsx`, `Main.jsx`, `Login.jsx`, `Suspense`, `ProfilePictureInput`)

- [ ] **Step 1: Migrate these 5 files following the Section pattern**
- [ ] **Step 2: Run E2E**
- [ ] **Step 3: Commit** `refactor(ui): migrate app shell to TypeScript`

---

## Milestone 7 — Feature Folders

**Deliverable:** All feature folders (events, members, tasks, etc.) are TypeScript.

**Estimate:** 20–30 hours. This is the bulk of the work.

**Migration order (smallest-first so effort ramps up):**

1. `orbat/` (1 file) — 30 min
2. `dashboard/` (1 file) — 30 min
3. `backup/` (1 file) — 1 h
4. `settings/` (2 files) — 1 h
5. `logs/` (4 files) — 1.5 h
6. `specializations/` (4 files) — 1.5 h
7. `squads/` (5 files) — 2 h
8. `questionnaires/` (8 files) — 3 h
9. `tasks/` (9 files) — 3 h
10. `registration/` (9 files) — 3 h
11. `events/` (10 files) — 4 h
12. `members/` (24 files) — 6 h

### Task 7.N (template, repeat per feature folder): Migrate `{feature}/`

**Files:** every `.jsx` in `imports/ui/{feature}/`

- [ ] **Step 1: Rename all `.jsx` in folder to `.tsx`, all `.js` to `.ts`**

```bash
cd imports/ui/{feature}
for f in *.jsx; do git mv "$f" "${f%.jsx}.tsx"; done
for f in *.js; do [ "$f" != "*.js" ] && git mv "$f" "${f%.js}.ts"; done
```

- [ ] **Step 2: Replace PropTypes with interfaces**

Pattern — before:
```jsx
MyComponent.propTypes = {
  title: PropTypes.string,
  items: PropTypes.arrayOf(PropTypes.object).isRequired,
  onSelect: PropTypes.func,
};
```

After:
```tsx
interface MyComponentProps {
  title?: string;
  items: Item[];
  onSelect?: (item: Item) => void;
}

export default function MyComponent({ title = '', items, onSelect }: MyComponentProps) {
  // body unchanged
}
```

Delete the `PropTypes` import and the assignment block.

- [ ] **Step 3: Type `useState`, `useTracker`, `useFind` calls**

```tsx
const [selected, setSelected] = useState<string | null>(null);
const events = useFind(() => EventsCollection.find(filter), [filter]);
// events is inferred as EventDoc[]
```

- [ ] **Step 4: Type form `onFinish` handlers with Ant Design's `FormProps`**

```tsx
const handleFinish = async (values: MyFormValues) => { ... };
```

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Fix any errors that surface.

- [ ] **Step 6: Run relevant E2E spec**

Run: `npm run e2e -- {feature}.spec.ts`
Expected: all tests pass (behavior unchanged).

- [ ] **Step 7: Commit**

```bash
git commit -m "refactor(ui): migrate {feature} folder to TypeScript"
```

**Milestone 7 close commit:**
```bash
git commit -m "refactor(ui): complete TypeScript migration of all feature folders"
```

---

## Milestone 8 — Tightening (strict mode + PropTypes removal)

**Deliverable:** `strict: true` in `tsconfig.json`, no remaining PropTypes imports, `jsconfig.json` and `prop-types` dependency removed, CLAUDE.md updated.

**Estimate:** 2–4 hours.

### Task 8.1: Enable strict mode

- [ ] **Step 1: Update `tsconfig.json`**

```json
"strict": true,
"noImplicitAny": true,
"noImplicitReturns": true,
"noFallthroughCasesInSwitch": true,
"noUnusedLocals": true,
"noUnusedParameters": true
```

- [ ] **Step 2: Run typecheck, fix surfaced errors**

Run: `npm run typecheck`
Expected: errors in files that relied on implicit any.

For each error:
- Add explicit types where the inference was wrong
- Guard nullable accesses with `if (x)` or `x?.y`
- Avoid `any` — use `unknown` or the correct type

- [ ] **Step 3: Run tests**

Run: `npm test && npm run e2e`
Expected: all pass.

- [ ] **Step 4: Commit** `build: enable TypeScript strict mode`

### Task 8.2: Remove `prop-types` dependency

- [ ] **Step 1: Verify no imports remain**

Run: `grep -r "prop-types" imports/ server/ client/ --include="*.tsx" --include="*.ts"`
Expected: no output.

- [ ] **Step 2: Remove from `package.json`**

```bash
npm uninstall prop-types
```

- [ ] **Step 3: Remove any remaining `.propTypes = {...}` assignments if they slipped through**

- [ ] **Step 4: Commit** `chore: remove prop-types dependency`

### Task 8.3: Update `CLAUDE.md`

- [ ] **Step 1: Replace PropTypes guidance** in the "React Components" section

Before: *"PropTypes required for all props (define after component)"*
After: *"Component props defined as TypeScript interfaces above the component"*

- [ ] **Step 2: Remove references to `jsconfig.json`** — it no longer exists

- [ ] **Step 3: Add TypeScript section under "Coding Guidelines"**

```markdown
### TypeScript

- Use types from `imports/api/types/` for all collection documents
- Method calls use typed `Meteor.callAsync<CrudMethodName>(...)` where possible
- Prefer `unknown` over `any`; use `asserts` type guards for validators
- Strict null checks are enforced — handle nullable values explicitly
```

- [ ] **Step 4: Commit** `docs: update CLAUDE.md for TypeScript-native codebase`

---

## Rollback Strategy

At any milestone boundary the migration can pause indefinitely — the mixed JS/TS state is stable because `allowJs: true` keeps unmigrated files compiling normally.

If a specific task introduces a regression:
- `git revert <commit>` — safe because each task is a single focused commit
- No stateful migration (no DB changes, no dependency migrations) so reverts are reversible at any point

If the whole migration needs to be abandoned:
- `git revert` back to `main@{before Task 1.1}`
- `npm install prop-types` if removed (Milestone 8.2)
- Restore `jsconfig.json` from git history

---

## Verification Gates (run between every milestone)

- `npm run typecheck` — must exit 0
- `npm test` — must show `168 passing` (grows as new tests are added)
- `npm run e2e` — must pass, especially after Milestone 6/7 UI changes
- Manual smoke test in browser: login, navigate to each feature, verify attendance recording still works

---

## Summary

| Milestone | Focus | Effort | Shippable Outcome |
|-----------|-------|--------|-------------------|
| M1 | Foundation | 2–3 h | `tsconfig.json`, global types, typecheck CI |
| M2 | Collection schemas | 3–4 h | 19 typed collections |
| M3 | Server infrastructure | 6–8 h | Typed `main.ts`, `crud.lib.ts`, registry |
| M4 | Remaining server APIs | 5–8 h | Full server in TS |
| M5 | i18n, helpers, config | 2–3 h | Non-UI modules complete |
| M6 | UI foundation | 4–6 h | Shared components typed |
| M7 | Feature folders | 20–30 h | Full UI typed |
| M8 | Tightening | 2–4 h | Strict mode, PropTypes gone |
| **Total** | | **44–66 h** | Fully TypeScript codebase |
