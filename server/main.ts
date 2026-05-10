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
import './apis/backup.server';
import './apis/dashboard.server';
import './apis/demoData.server';
import './apis/events.server';
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
import { CACHE, SQUAD_SCOPED_PERMISSIONS } from './config';

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

async function createDatabaseIndexes(): Promise<void> {
  await MembersCollection.rawCollection().createIndex({ 'profile.squadId': 1 });
  await MembersCollection.rawCollection().createIndex({ 'profile.rankId': 1 });

  await AttendancesCollection.rawCollection().createIndex({ eventId: 1 });

  await LogsCollection.rawCollection().createIndex({ createdAt: -1 });
  await LogsCollection.rawCollection().createIndex({ action: 1 });

  await EventsCollection.rawCollection().createIndex({ eventType: 1 });

  await TasksCollection.rawCollection().createIndex({ status: 1 });

  await RegistrationsCollection.rawCollection().createIndex({ discoveryType: 1 });
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
