import { Accounts } from 'meteor/accounts-base';
import { Meteor } from 'meteor/meteor';
import AttendancesCollection from '../imports/api/collections/attendances.collection';
import EventsCollection from '../imports/api/collections/events.collection';
import LogsCollection from '../imports/api/collections/logs.collection';
import MembersCollection from '../imports/api/collections/members.collection';
import RegistrationsCollection from '../imports/api/collections/registrations.collection';
import RolesCollection from '../imports/api/collections/roles.collection';
import TasksCollection from '../imports/api/collections/tasks.collection';
import type { CrudCollectionName, Role } from '/imports/api/types';
import './apis/attendances.server';
import './apis/backup.server';
import './apis/dashboard.server';
import './apis/demoData.server';
import './apis/events.server';
import './apis/integrity.server';
import './apis/logs.server';
import './apis/members.server';
import './apis/orbat.server';
import './apis/palette.server';
import './apis/questionnaireResponses.server';
import './apis/questionnaires.server';
import './apis/registrations.server';
import './apis/settings.server';
import './apis/specializations.server';
import './apis/squads.server';
import './apis/tasks.server';
import { COLLECTION_REGISTRY } from './collection-registry';
import { createCollectionMethods, createCollectionPublish } from './crud.lib';
import { CACHE, LOGS, SQUAD_SCOPED_PERMISSIONS } from './config';

// === Permission System ===

export type CrudOperation = 'read' | 'create' | 'update' | 'delete';

const BOOLEAN_MODULES: readonly string[] = ['dashboard', 'orbat', 'logs', 'settings'];

// Distinct CRUD-style permission modules across the registry, minus boolean
// modules. Used by normalizeRolePermissions to expand `role[mod] = true` into
// the four-op object. Derived from the registry so adding a collection
// updates this set automatically.
const CRUD_MODULE_SET: readonly string[] = [
  ...new Set(Object.values(COLLECTION_REGISTRY).map(entry => entry.module)),
].filter(module => !BOOLEAN_MODULES.includes(module));

interface RoleCacheEntry {
  role: Role | null;
  timestamp: number;
}

const roleCache = new Map<string, RoleCacheEntry>();
const CACHE_TTL = 60000;
const CACHE_CLEANUP_INTERVAL = 300000;
const CACHE_MAX_SIZE = 1000;

function cleanupRoleCache(): void {
  const now = Date.now();
  for (const [key, value] of roleCache.entries()) {
    if (now - value.timestamp >= CACHE_TTL) {
      roleCache.delete(key);
    }
  }
}

if (Meteor.isServer) {
  Meteor.setInterval(cleanupRoleCache, CACHE_CLEANUP_INTERVAL);
}

export function normalizeRolePermissions(role: Role | null | undefined): Role | null {
  if (!role) return null;

  const normalized: Role = { ...role };

  const isAdmin = role.roles === true;

  for (const module of CRUD_MODULE_SET) {
    const key = module as keyof Role;
    const permission = role[key];
    if (permission === true) {
      (normalized as unknown as Record<string, unknown>)[module] = { read: true, create: true, update: true, delete: true };
    } else if (permission === false || permission === undefined) {
      (normalized as unknown as Record<string, unknown>)[module] = { read: false, create: false, update: false, delete: false };
    }
  }

  if (isAdmin) normalized.roles = true;

  return normalized;
}

export async function getUserRole(userId: string | null | undefined): Promise<Role | null> {
  if (!userId) return null;

  const user = await MembersCollection.findOneAsync(userId);
  if (!user?.profile?.roleId) return null;

  const roleId = user.profile.roleId as string;
  const cacheKey = roleId;
  const cached = roleCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE.roleTtlMs) {
    return cached.role;
  }

  const role = (await RolesCollection.findOneAsync(roleId)) as Role | undefined;
  const normalizedRole = normalizeRolePermissions(role);

  if (roleCache.size >= CACHE_MAX_SIZE) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, value] of roleCache.entries()) {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        oldestKey = key;
      }
    }
    if (oldestKey) roleCache.delete(oldestKey);
  }

  roleCache.set(cacheKey, { role: normalizedRole, timestamp: Date.now() });

  return normalizedRole;
}

export async function checkPermission(
  userId: string | null | undefined,
  module: string,
  operation?: CrudOperation,
): Promise<boolean> {
  const role = await getUserRole(userId);

  if (!role) return false;

  if (role.roles === true) return true;

  const permission = (role as unknown as Record<string, unknown>)[module];

  if (BOOLEAN_MODULES.includes(module)) {
    return permission === true;
  }

  if (typeof permission === 'object' && permission !== null && operation) {
    return (permission as Record<string, boolean>)[operation] === true;
  }

  if (permission === true) {
    return true;
  }

  return false;
}

export function clearRoleCache(roleId?: string): void {
  if (roleId) {
    roleCache.delete(roleId);
  } else {
    roleCache.clear();
  }
}

export async function checkSpecialPermission(userId: string | null | undefined, flag: string): Promise<boolean> {
  const role = await getUserRole(userId);
  if (!role) return false;
  return (role as unknown as Record<string, unknown>)[flag] === true;
}

export { BOOLEAN_MODULES };

export function isOfficerOrAdmin(role: Role | null | undefined): boolean {
  if (!role) return false;
  return role.roles === true;
}

export async function getSquadScope(
  userId: string | null | undefined,
): Promise<{ 'profile.squadId'?: string }> {
  if (!SQUAD_SCOPED_PERMISSIONS.enabled) return {};

  const role = await getUserRole(userId);
  if (isOfficerOrAdmin(role)) return {};

  if (!userId) return {};
  const user = await MembersCollection.findOneAsync(userId);
  const squadId = user?.profile?.squadId as string | undefined;
  if (!squadId) return {};

  return { 'profile.squadId': squadId };
}

async function createTestData(): Promise<void> {
  await RolesCollection.upsertAsync({ _id: 'admin' }, { $set: { name: 'admin', roles: true } });
  const user = await MembersCollection.findOneAsync({ username: 'admin' });
  if (user) return;
  console.warn('[SECURITY] Creating default admin user with test credentials. This should only happen in development.');
  await Accounts.createUserAsync({ username: 'admin', password: 'admin', profile: { name: 'Admin', roleId: 'admin' } });
}

// Merge duplicate per-event Attendance docs into a single canonical row, then
// (re)build the unique { eventId } index. Idempotent and startup-safe.
//
// Context: the grid stores exactly ONE document per event, with each member's
// status held under a dynamic [memberId] key. The unique { eventId } index
// (#261) closes the read-then-write race in attendances.upsert. But promoting
// the old non-unique index to `unique: true` on an EXISTING deployment fails
// two ways with no protection:
//   1. IndexOptionsConflict (code 85) — a non-unique { eventId } index already
//      exists, so createIndex with different options is rejected.
//   2. Duplicate-key build error — pre-existing duplicate per-event docs make
//      the unique index unbuildable.
// Both crash startup if unhandled. So: dedupe first, drop any conflicting
// non-unique index, then create the unique one. The race protection must
// remain — if the unique index genuinely cannot be created we log loudly
// rather than swallow it.
export async function ensureAttendancesUniqueIndex(): Promise<void> {
  const raw = AttendancesCollection.rawCollection();

  // 1. Dedupe: collapse any groups of docs sharing an eventId into one doc,
  //    merging their per-member status keys. No-op when there are no dupes.
  await dedupeAttendancesByEventId();

  // 2. Resolve a pre-existing non-unique { eventId } index that would otherwise
  //    trigger IndexOptionsConflict. Drop it so the unique index can be created.
  try {
    const existing = (await raw.indexes()) as Array<{ name?: string; key?: Record<string, number>; unique?: boolean }>;
    const conflicting = existing.find(idx => idx.key && idx.key.eventId === 1 && Object.keys(idx.key).length === 1 && !idx.unique);
    if (conflicting?.name) {
      await raw.dropIndex(conflicting.name);
    }
  } catch (error) {
    // indexes()/dropIndex can fail on a missing collection (never created yet)
    // — that's fine, createIndex below will materialise it. Log and continue.
    console.warn('[attendances] could not inspect/drop existing { eventId } index:', error);
  }

  // 3. Create the unique index. This is the race protection from #261 and must
  //    succeed — if it cannot (e.g. dedupe somehow left dupes), log loudly.
  try {
    await raw.createIndex({ eventId: 1 }, { unique: true });
  } catch (error) {
    console.error(
      '[attendances] FAILED to create the unique { eventId } index — the attendances.upsert race protection (#261) is NOT active. Investigate duplicate per-event documents:',
      error,
    );
  }
}

// Find Attendance docs sharing an eventId and merge each group into a single
// canonical doc (combine per-member status keys; keep the oldest doc, remove
// the rest). Later docs win on key conflicts. Idempotent: a no-op once every
// eventId maps to exactly one doc.
async function dedupeAttendancesByEventId(): Promise<void> {
  const raw = AttendancesCollection.rawCollection();
  const duplicateGroups = (await raw
    .aggregate([
      { $match: { eventId: { $exists: true } } },
      { $group: { _id: '$eventId', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray()) as Array<{ _id: string }>;

  for (const group of duplicateGroups) {
    const docs = await AttendancesCollection.find({ eventId: group._id }).fetchAsync();
    if (docs.length <= 1) continue;
    // Keep the lexicographically-first _id as canonical; merge all member-status
    // keys from the rest onto it (later docs override earlier on key collisions).
    const sorted = [...docs].sort((a, b) => String(a._id).localeCompare(String(b._id)));
    const [canonical, ...extras] = sorted;
    const merged: Record<string, unknown> = {};
    for (const doc of sorted) {
      for (const [key, value] of Object.entries(doc)) {
        if (key === '_id' || key === 'eventId') continue;
        merged[key] = value;
      }
    }
    await AttendancesCollection.updateAsync(canonical._id as string, { $set: merged } as never);
    await AttendancesCollection.removeAsync({ _id: { $in: extras.map(doc => doc._id as string) } });
  }
}

// Audit-log retention: a MongoDB TTL index expires log documents
// `LOGS.retentionSeconds` after their `createdAt`. Kept on its own ascending
// field (`logRetentionAt`) — distinct from the descending `{ createdAt: -1 }`
// query index — so the retention window can change without colliding with that
// index's options (Mongo rejects `collMod` direction changes, and reuses a
// matching key spec for TTL). A retention of 0 disables expiry; we drop the TTL
// index in that case so logs are kept forever.
export const LOG_TTL_INDEX_NAME = 'logRetentionTtl';

export async function ensureLogRetentionIndex(): Promise<void> {
  const raw = LogsCollection.rawCollection();
  const retentionSeconds = LOGS.retentionSeconds;

  if (retentionSeconds <= 0) {
    // Retention disabled — remove any previously-created TTL index. Ignore the
    // "index not found" error so a fresh DB (no index yet) is a no-op.
    try {
      await raw.dropIndex(LOG_TTL_INDEX_NAME);
    } catch {
      // No TTL index to drop.
    }
    return;
  }

  // createIndex is idempotent on an identical spec; if only expireAfterSeconds
  // changed, Mongo updates it in place via the same index name.
  await raw.createIndex({ createdAt: 1 }, { name: LOG_TTL_INDEX_NAME, expireAfterSeconds: retentionSeconds });
}

async function createDatabaseIndexes(): Promise<void> {
  // Every createIndex call is independent — race them on startup instead of
  // running sequential round-trips. Mongo will dedupe if any already exist.
  // The Attendances unique { eventId } index needs a dedupe + conflict-resolve
  // preamble (see ensureAttendancesUniqueIndex), so it runs through that helper.
  await Promise.all([
    MembersCollection.rawCollection().createIndex({ 'profile.squadId': 1 }),
    MembersCollection.rawCollection().createIndex({ 'profile.rankId': 1 }),
    ensureAttendancesUniqueIndex(),
    LogsCollection.rawCollection().createIndex({ createdAt: -1 }),
    LogsCollection.rawCollection().createIndex({ action: 1 }),
    EventsCollection.rawCollection().createIndex({ eventType: 1 }),
    TasksCollection.rawCollection().createIndex({ status: 1 }),
    RegistrationsCollection.rawCollection().createIndex({ discoveryType: 1 }),
    ensureLogRetentionIndex(),
  ]);
}

if (Meteor.isServer) {
  Meteor.startup(async () => {
    if (process.env.NODE_ENV !== 'production') {
      await createTestData();
    }
    await createDatabaseIndexes();
  });
}

const collectionNames: readonly CrudCollectionName[] = [
  'attendances',
  'briefingTemplates',
  'discoveryTypes',
  'eventTypes',
  'medals',
  'positions',
  'profilePictures',
  'questionnaires',
  'questionnaireResponses',
  'ranks',
  'registrations',
  'roles',
  'specializations',
  'squads',
  'taskStatus',
  'tasks',
];

const methodOnlyCollections: readonly CrudCollectionName[] = ['events'];

if (Meteor.isServer) {
  for (const collectionName of collectionNames) {
    createCollectionPublish(collectionName);
    createCollectionMethods(collectionName);
  }
  for (const collectionName of methodOnlyCollections) {
    createCollectionMethods(collectionName);
  }
}

export function validateUserId(userId: unknown): asserts userId is string {
  if (!userId || typeof userId !== 'string') {
    throw new Meteor.Error('validateUserId', 'not-authorized', JSON.stringify(userId));
  }
}

function validateOptionalString(string: unknown): void {
  if (string && typeof string !== 'string') {
    throw new Meteor.Error('validateOptionalString', 'Invalid string', JSON.stringify(string));
  }
}

function validateRequiredString(string: unknown): asserts string is string {
  if (!string || typeof string !== 'string') {
    throw new Meteor.Error('validateRequiredString', 'Invalid string', JSON.stringify(string));
  }
}

export function validateString(string: unknown, optional: boolean = false): asserts string is string {
  if (optional) {
    validateOptionalString(string);
  } else {
    validateRequiredString(string);
  }
}

function validateOptionalNumber(number: unknown): void {
  if (number && typeof number !== 'number') {
    throw new Meteor.Error('validateOptionalNumber', 'Invalid number', JSON.stringify(number));
  }
}

function validateRequiredNumber(number: unknown): asserts number is number {
  if (typeof number !== 'number') {
    throw new Meteor.Error('validateRequiredNumber', 'Invalid number', JSON.stringify(number));
  }
}

export function validateNumber(number: unknown, optional: boolean = false): asserts number is number {
  if (optional) {
    validateOptionalNumber(number);
  } else {
    validateRequiredNumber(number);
  }
}

function validateOptionalBoolean(boolean: unknown): void {
  if (boolean && typeof boolean !== 'boolean') {
    throw new Meteor.Error('validateOptionalBoolean', 'Invalid boolean', JSON.stringify(boolean));
  }
}

function validateRequiredBoolean(boolean: unknown): asserts boolean is boolean {
  if (typeof boolean !== 'boolean') {
    throw new Meteor.Error('validateRequiredBoolean', 'Invalid boolean', JSON.stringify(boolean));
  }
}

export function validateBoolean(boolean: unknown, optional: boolean = false): asserts boolean is boolean {
  if (optional) {
    validateOptionalBoolean(boolean);
  } else {
    validateRequiredBoolean(boolean);
  }
}

function validateOptionalDate(date: unknown): void {
  if (date && typeof date !== 'object') {
    throw new Meteor.Error('validateOptionalDate', 'Invalid date', JSON.stringify(date));
  }
}

function validateRequiredDate(date: unknown): asserts date is Date {
  if (!date || typeof date !== 'object') {
    throw new Meteor.Error('validateRequiredDate', 'Invalid date', JSON.stringify(date));
  }
}

export function validateDate(date: unknown, optional: boolean = false): asserts date is Date {
  if (optional) {
    validateOptionalDate(date);
  } else {
    validateRequiredDate(date);
  }
}

function validateOptionalArray(array: unknown): void {
  if (array && !Array.isArray(array)) {
    throw new Meteor.Error('validateOptionalArray', 'Invalid array', JSON.stringify(array));
  }
}

function validateRequiredArray(array: unknown): asserts array is unknown[] {
  if (!array || !Array.isArray(array)) {
    throw new Meteor.Error('validateRequiredArray', 'Invalid array', JSON.stringify(array));
  }
}

export function validateArray(array: unknown, optional: boolean = false): asserts array is unknown[] {
  if (optional) {
    validateOptionalArray(array);
  } else {
    validateRequiredArray(array);
  }
}

function validateOptionalArrayOfStrings(array: unknown): void {
  if (array && !Array.isArray(array)) {
    throw new Meteor.Error('validateOptionalArrayOfStrings', 'Invalid array', JSON.stringify(array));
  }
  if (array && Array.isArray(array) && !array.every(item => typeof item === 'string')) {
    throw new Meteor.Error('validateOptionalArrayOfStrings', 'Invalid array', JSON.stringify(array));
  }
}

function validateRequiredArrayOfStrings(array: unknown): asserts array is string[] {
  if (!array || !Array.isArray(array)) {
    throw new Meteor.Error('validateRequiredArrayOfStrings', 'Invalid array', JSON.stringify(array));
  }
  if (array && Array.isArray(array) && !array.every(item => typeof item === 'string')) {
    throw new Meteor.Error('validateRequiredArrayOfStrings', 'Invalid array', JSON.stringify(array));
  }
}

export function validateArrayOfStrings(array: unknown, optional: boolean = false): asserts array is string[] {
  if (optional) {
    validateOptionalArrayOfStrings(array);
  } else {
    validateRequiredArrayOfStrings(array);
  }
}

function validateOptionalObject(object: unknown): void {
  if (object && typeof object !== 'object') {
    throw new Meteor.Error('validateOptionalObject', 'Invalid object', JSON.stringify(object));
  }
}

function validateRequiredObject(object: unknown): void {
  if (!object || typeof object !== 'object') {
    throw new Meteor.Error('validateRequiredObject', 'Invalid object', JSON.stringify(object));
  }
}

export function validateObject(object: unknown, optional: boolean = false): void {
  if (optional) {
    validateOptionalObject(object);
  } else {
    validateRequiredObject(object);
  }
}

export function validatePublish(userId: unknown, filter: unknown, options: unknown): void {
  validateUserId(userId);
  validateObject(filter, false);
  validateObject(options, false);
}

// Mongo query operators that allow arbitrary server-side code execution or
// expression evaluation. Permitting these in a client-supplied selector lets a
// caller bypass field-level access controls and run unbounded scans (SEC-002/
// 005/012). They have no legitimate use in this app's read paths.
const DISALLOWED_QUERY_OPERATORS: readonly string[] = ['$where', '$expr', '$function', '$accumulator'];

// Recursively asserts that a client-supplied Mongo selector contains none of
// the code-execution operators above. Throws Meteor.Error(400) on the first
// offending key. Wire this into every path that forwards an untrusted filter
// to Mongo (generic .read, publications, members.findOne, persisted filters).
export function assertSafeSelector(filter: unknown): void {
  validateObject(filter, false);
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (DISALLOWED_QUERY_OPERATORS.includes(key)) {
        throw new Meteor.Error(400, `Disallowed query operator: ${key}`);
      }
      walk(value);
    }
  };
  walk(filter);
}
