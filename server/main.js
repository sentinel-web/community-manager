import { Accounts } from 'meteor/accounts-base';
import { Meteor } from 'meteor/meteor';
import MembersCollection from '../imports/api/collections/members.collection';
import RolesCollection from '../imports/api/collections/roles.collection';
import './apis/backup.server';
import './apis/dashboard.server';
import './apis/logs.server';
import './apis/members.server';
import './apis/orbat.server';
import './apis/registrations.server';
import './apis/settings.server';
import './apis/specializations.server';
import './crud.lib';
import { createCollectionMethods, createCollectionPublish } from './crud.lib';
import { CACHE } from './config';

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
};

// Role cache for performance (TTL configurable via Meteor.settings)
const roleCache = new Map();

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

async function createTestData() {
  const adminRole = await RolesCollection.findOneAsync({ _id: 'admin' });
  if (!adminRole) await RolesCollection.upsertAsync({ _id: 'admin' }, { _id: 'admin', name: 'admin', roles: true });
  const user = await MembersCollection.findOneAsync({ username: 'admin' });
  if (user) return;
  await Accounts.createUserAsync({ username: 'admin', password: 'admin', profile: { name: 'Admin', roleId: 'admin' } });
}

if (Meteor.isServer) {
  Meteor.startup(async () => {
    await createTestData();
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
  if (!number || typeof number !== 'number') {
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
  if (!boolean || typeof boolean !== 'boolean') {
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
