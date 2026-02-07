import { Accounts } from 'meteor/accounts-base';
import { Meteor } from 'meteor/meteor';
import AttendancesCollection from '../imports/api/collections/attendances.collection';
import EventsCollection from '../imports/api/collections/events.collection';
import LogsCollection from '../imports/api/collections/logs.collection';
import MembersCollection from '../imports/api/collections/members.collection';
import RegistrationsCollection from '../imports/api/collections/registrations.collection';
import RolesCollection from '../imports/api/collections/roles.collection';
import TasksCollection from '../imports/api/collections/tasks.collection';
import './apis/backup.server';
import './apis/dashboard.server';
import './apis/events.server';
import './apis/logs.server';
import './apis/members.server';
import './apis/orbat.server';
import './apis/registrations.server';
import './apis/settings.server';
import './apis/specializations.server';
import './apis/questionnaireResponses.server';
import './crud.lib';
import { createCollectionMethods, createCollectionPublish } from './crud.lib';
import { CACHE, SQUAD_SCOPED_PERMISSIONS } from './config';

// === Permission System ===

// Modules that use boolean permissions (true/false)
const BOOLEAN_MODULES = ['dashboard', 'orbat', 'logs', 'settings'];

// Modules that use CRUD permissions (read/create/update/delete)
const CRUD_MODULES = [
  'members',
  'events',
  'tasks',
  'squads',
  'ranks',
  'specializations',
  'medals',
  'eventTypes',
  'taskStatus',
  'registrations',
  'discoveryTypes',
  'roles',
  'questionnaires',
];

// Map collection names to permission modules
const COLLECTION_TO_MODULE = {
  members: 'members',
  events: 'events',
  attendances: 'events', // attendances are part of events module
  tasks: 'tasks',
  squads: 'squads',
  ranks: 'ranks',
  specializations: 'specializations',
  medals: 'medals',
  eventTypes: 'eventTypes',
  taskStatus: 'taskStatus',
  registrations: 'registrations',
  discoveryTypes: 'discoveryTypes',
  roles: 'roles',
  profilePictures: 'members', // profile pictures are part of members module
  questionnaires: 'questionnaires',
  questionnaireResponses: 'questionnaires', // responses use questionnaires permission module
};

// Role cache for performance (TTL configurable via Meteor.settings)
const roleCache = new Map();
const CACHE_TTL = 60000; // 1 minute
const CACHE_CLEANUP_INTERVAL = 300000; // 5 minutes
const CACHE_MAX_SIZE = 1000; // Maximum number of entries

/**
 * Cleans up expired entries from the role cache.
 * Runs periodically to prevent unbounded memory growth.
 */
function cleanupRoleCache() {
  const now = Date.now();
  for (const [key, value] of roleCache.entries()) {
    if (now - value.timestamp >= CACHE_TTL) {
      roleCache.delete(key);
    }
  }
}

// Start periodic cache cleanup on server
if (Meteor.isServer) {
  Meteor.setInterval(cleanupRoleCache, CACHE_CLEANUP_INTERVAL);
}

/**
 * Normalizes role permissions from old boolean format to new CRUD object format.
 * - Boolean modules remain unchanged (dashboard, orbat, logs, settings)
 * - CRUD modules: `true` becomes { read: true, create: true, update: true, delete: true }
 * - CRUD modules: `false` or undefined becomes { read: false, create: false, update: false, delete: false }
 */
export function normalizeRolePermissions(role) {
  if (!role) return null;

  const normalized = { ...role };

  for (const module of CRUD_MODULES) {
    const permission = role[module];
    if (permission === true) {
      // Old format: true means full access
      normalized[module] = { read: true, create: true, update: true, delete: true };
    } else if (permission === false || permission === undefined) {
      // Old format: false or undefined means no access
      normalized[module] = { read: false, create: false, update: false, delete: false };
    }
    // If already an object, leave it as-is
  }

  return normalized;
}

/**
 * Gets a user's role with caching.
 * Returns the normalized role object.
 */
export async function getUserRole(userId) {
  if (!userId) return null;

  const user = await MembersCollection.findOneAsync(userId);
  if (!user?.profile?.roleId) return null;

  const roleId = user.profile.roleId;
  const cacheKey = roleId;
  const cached = roleCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE.roleTtlMs) {
    return cached.role;
  }

  const role = await RolesCollection.findOneAsync(roleId);
  const normalizedRole = normalizeRolePermissions(role);

  // Evict oldest entries if cache exceeds max size
  if (roleCache.size >= CACHE_MAX_SIZE) {
    let oldestKey = null;
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

/**
 * Checks if a user has permission for a specific operation on a module.
 * @param {string} userId - The user's ID
 * @param {string} module - The permission module (e.g., 'members', 'events')
 * @param {string} operation - The operation ('read', 'create', 'update', 'delete')
 * @returns {Promise<boolean>} - Whether the user has permission
 */
export async function checkPermission(userId, module, operation) {
  const role = await getUserRole(userId);

  if (!role) return false;

  // Handle special admin role that has `roles: true`
  if (role.roles === true) return true;

  const permission = role[module];

  // Boolean modules
  if (BOOLEAN_MODULES.includes(module)) {
    return permission === true;
  }

  // CRUD modules
  if (typeof permission === 'object' && permission !== null) {
    return permission[operation] === true;
  }

  // Fallback for old boolean format on CRUD modules
  if (permission === true) {
    return true;
  }

  return false;
}

/**
 * Clears the role cache for a specific role or all roles.
 * Call this when roles are updated.
 */
export function clearRoleCache(roleId) {
  if (roleId) {
    roleCache.delete(roleId);
  } else {
    roleCache.clear();
  }
}

/**
 * Gets the permission module for a collection name.
 */
export function getPermissionModule(collectionName) {
  return COLLECTION_TO_MODULE[collectionName] || null;
}

// Export constants for use in other modules
export { BOOLEAN_MODULES, CRUD_MODULES };

/**
 * Checks if a role represents an officer or admin.
 * Officers/admins bypass squad-scoped filtering.
 */
export function isOfficerOrAdmin(role) {
  if (!role) return false;
  return role.roles === true;
}

/**
 * Gets squad scope filter for a user.
 * Non-officers get filtered to their own squad; officers/admins get no filter.
 * @param {string} userId - The user's ID
 * @returns {Promise<Object>} - MongoDB filter to apply, or empty object for officers
 */
export async function getSquadScope(userId) {
  if (!SQUAD_SCOPED_PERMISSIONS.enabled) return {};

  const role = await getUserRole(userId);
  if (isOfficerOrAdmin(role)) return {};

  const user = await MembersCollection.findOneAsync(userId);
  const squadId = user?.profile?.squadId;
  if (!squadId) return {};

  return { 'profile.squadId': squadId };
}

/**
 * Creates test data for development environments only.
 * WARNING: This creates an admin user with default credentials.
 * Never run in production - gated by NODE_ENV check.
 */
async function createTestData() {
  // Always ensure admin role has full permissions (idempotent)
  await RolesCollection.upsertAsync({ _id: 'admin' }, { $set: { name: 'admin', roles: true } });
  const user = await MembersCollection.findOneAsync({ username: 'admin' });
  if (user) return;
  console.warn('[SECURITY] Creating default admin user with test credentials. This should only happen in development.');
  await Accounts.createUserAsync({ username: 'admin', password: 'admin', profile: { name: 'Admin', roleId: 'admin' } });
}

/**
 * Creates database indexes for common queries.
 * Indexes improve query performance by avoiding full collection scans.
 * createIndex() is idempotent - safe to call on every startup.
 */
async function createDatabaseIndexes() {
  // Members (Meteor.users) indexes
  // Note: Meteor already creates a unique, sparse index on 'username'
  await MembersCollection.rawCollection().createIndex({ 'profile.squadId': 1 });
  await MembersCollection.rawCollection().createIndex({ 'profile.rankId': 1 });

  // Attendances indexes
  await AttendancesCollection.rawCollection().createIndex({ eventId: 1 });

  // Logs indexes
  await LogsCollection.rawCollection().createIndex({ createdAt: -1 });
  await LogsCollection.rawCollection().createIndex({ action: 1 });

  // Events indexes
  await EventsCollection.rawCollection().createIndex({ eventType: 1 });

  // Tasks indexes
  await TasksCollection.rawCollection().createIndex({ status: 1 });

  // Registrations indexes
  await RegistrationsCollection.rawCollection().createIndex({ discoveryType: 1 });
}

if (Meteor.isServer) {
  Meteor.startup(async () => {
    // Only create test data in development environments
    // In production, admin users must be created manually or via secure setup
    if (process.env.NODE_ENV !== 'production') {
      await createTestData();
    }
    await createDatabaseIndexes();
  });
}

const collectionNames = [
  'events',
  'attendances',
  'eventTypes',
  'tasks',
  'taskStatus',
  // 'members', // ! handled separately
  'squads',
  'ranks',
  'specializations',
  'medals',
  'registrations',
  'discoveryTypes',
  // 'settings', // ! handled separately
  'roles',
  'profilePictures',
  'questionnaires',
  'questionnaireResponses',
];

if (Meteor.isServer) {
  for (const collectionName of collectionNames) {
    createCollectionPublish(collectionName);
    createCollectionMethods(collectionName);
  }
}

export function validateUserId(userId) {
  if (!userId || typeof userId !== 'string') {
    throw new Meteor.Error('validateUserId', 'not-authorized', JSON.stringify(userId));
  }
}

function validateOptionalString(string) {
  if (string && typeof string !== 'string') {
    throw new Meteor.Error('validateOptionalString', 'Invalid string', JSON.stringify(string));
  }
}

function validateRequiredString(string) {
  if (!string || typeof string !== 'string') {
    throw new Meteor.Error('validateRequiredString', 'Invalid string', JSON.stringify(string));
  }
}

export function validateString(string, optional) {
  if (optional) {
    validateOptionalString(string);
  } else {
    validateRequiredString(string);
  }
}

function validateOptionalNumber(number) {
  if (number && typeof number !== 'number') {
    throw new Meteor.Error('validateOptionalNumber', 'Invalid number', JSON.stringify(number));
  }
}

function validateRequiredNumber(number) {
  if (typeof number !== 'number') {
    throw new Meteor.Error('validateRequiredNumber', 'Invalid number', JSON.stringify(number));
  }
}

export function validateNumber(number, optional) {
  if (optional) {
    validateOptionalNumber(number);
  } else {
    validateRequiredNumber(number);
  }
}

function validateOptionalBoolean(boolean) {
  if (boolean && typeof boolean !== 'boolean') {
    throw new Meteor.Error('validateOptionalBoolean', 'Invalid boolean', JSON.stringify(boolean));
  }
}

function validateRequiredBoolean(boolean) {
  if (typeof boolean !== 'boolean') {
    throw new Meteor.Error('validateRequiredBoolean', 'Invalid boolean', JSON.stringify(boolean));
  }
}

export function validateBoolean(boolean, optional) {
  if (optional) {
    validateOptionalBoolean(boolean);
  } else {
    validateRequiredBoolean(boolean);
  }
}

function validateOptionalDate(date) {
  if (date && typeof date !== 'object') {
    throw new Meteor.Error('validateOptionalDate', 'Invalid date', JSON.stringify(date));
  }
}

function validateRequiredDate(date) {
  if (!date || typeof date !== 'object') {
    throw new Meteor.Error('validateRequiredDate', 'Invalid date', JSON.stringify(date));
  }
}

export function validateDate(date, optional) {
  if (optional) {
    validateOptionalDate(date);
  } else {
    validateRequiredDate(date);
  }
}

function validateOptionalArray(array) {
  if (array && !Array.isArray(array)) {
    throw new Meteor.Error('validateOptionalArray', 'Invalid array', JSON.stringify(array));
  }
}

function validateRequiredArray(array) {
  if (!array || !Array.isArray(array)) {
    throw new Meteor.Error('validateRequiredArray', 'Invalid array', JSON.stringify(array));
  }
}

export function validateArray(array, optional) {
  if (optional) {
    validateOptionalArray(array);
  } else {
    validateRequiredArray(array);
  }
}

function validateOptionalArrayOfStrings(array) {
  if (array && !Array.isArray(array)) {
    throw new Meteor.Error('validateOptionalArrayOfStrings', 'Invalid array', JSON.stringify(array));
  }
  if (array && Array.isArray(array) && !array.every(item => typeof item === 'string')) {
    throw new Meteor.Error('validateOptionalArrayOfStrings', 'Invalid array', JSON.stringify(array));
  }
}

function validateRequiredArrayOfStrings(array) {
  if (!array || !Array.isArray(array)) {
    throw new Meteor.Error('validateRequiredArrayOfStrings', 'Invalid array', JSON.stringify(array));
  }
  if (array && Array.isArray(array) && !array.every(item => typeof item === 'string')) {
    throw new Meteor.Error('validateRequiredArrayOfStrings', 'Invalid array', JSON.stringify(array));
  }
}

export function validateArrayOfStrings(array, optional) {
  if (optional) {
    validateOptionalArrayOfStrings(array);
  } else {
    validateRequiredArrayOfStrings(array);
  }
}

function validateOptionalObject(object) {
  if (object && typeof object !== 'object') {
    throw new Meteor.Error('validateOptionalObject', 'Invalid object', JSON.stringify(object));
  }
}

function validateRequiredObject(object) {
  if (!object || typeof object !== 'object') {
    throw new Meteor.Error('validateRequiredObject', 'Invalid object', JSON.stringify(object));
  }
}

export function validateObject(object, optional) {
  if (optional) {
    validateOptionalObject(object);
  } else {
    validateRequiredObject(object);
  }
}

export function validatePublish(userId, filter, options) {
  validateUserId(userId);
  validateObject(filter, false);
  validateObject(options, false);
}
