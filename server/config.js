import { Meteor } from 'meteor/meteor';

/**
 * Server-side configuration with support for Meteor.settings overrides.
 * Values can be overridden via settings.json or METEOR_SETTINGS environment variable.
 *
 * Example settings.json:
 * {
 *   "rateLimits": {
 *     "backup": {
 *       "create": { "count": 5, "intervalMs": 60000 },
 *       "restore": { "count": 2, "intervalMs": 60000 }
 *     }
 *   },
 *   "cache": {
 *     "roleTtlMs": 60000
 *   }
 * }
 */

// Default values
const DEFAULTS = {
  rateLimits: {
    backup: {
      create: { count: 5, intervalMs: 60000 },
      restore: { count: 2, intervalMs: 60000 },
      createQuick: { count: 5, intervalMs: 60000 },
    },
  },
  cache: {
    roleTtlMs: 60000, // 1 minute
  },
  squadScopedPermissions: true,
};

/**
 * Get a nested value from an object using a path array.
 * @param {Object} obj - Object to get value from
 * @param {string[]} path - Array of keys forming the path
 * @returns {*} - Value at path or undefined
 */
function getNestedValue(obj, path) {
  return path.reduce((current, key) => current?.[key], obj);
}

/**
 * Get configuration value with Meteor.settings override support.
 * @param {string[]} path - Path to the config value
 * @param {*} defaultValue - Default value if not found
 * @returns {*} - Configuration value
 */
function getConfig(path, defaultValue) {
  // Try Meteor.settings first
  const settingsValue = getNestedValue(Meteor.settings, path);
  if (settingsValue !== undefined) {
    return settingsValue;
  }
  // Fall back to defaults
  const defaultsValue = getNestedValue(DEFAULTS, path);
  return defaultsValue !== undefined ? defaultsValue : defaultValue;
}

// Rate Limits
export const RATE_LIMITS = {
  backup: {
    create: {
      get count() {
        return getConfig(['rateLimits', 'backup', 'create', 'count'], 5);
      },
      get intervalMs() {
        return getConfig(['rateLimits', 'backup', 'create', 'intervalMs'], 60000);
      },
    },
    restore: {
      get count() {
        return getConfig(['rateLimits', 'backup', 'restore', 'count'], 2);
      },
      get intervalMs() {
        return getConfig(['rateLimits', 'backup', 'restore', 'intervalMs'], 60000);
      },
    },
    createQuick: {
      get count() {
        return getConfig(['rateLimits', 'backup', 'createQuick', 'count'], 5);
      },
      get intervalMs() {
        return getConfig(['rateLimits', 'backup', 'createQuick', 'intervalMs'], 60000);
      },
    },
  },
};

// Cache Configuration
export const CACHE = {
  get roleTtlMs() {
    return getConfig(['cache', 'roleTtlMs'], 60000);
  },
};

// Squad-Scoped Permissions
export const SQUAD_SCOPED_PERMISSIONS = {
  get enabled() {
    return getConfig(['squadScopedPermissions'], true);
  },
};
