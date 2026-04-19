import { Meteor } from 'meteor/meteor';

interface RateLimitBucket {
  count: number;
  intervalMs: number;
}

interface Defaults {
  rateLimits: {
    backup: {
      create: RateLimitBucket;
      restore: RateLimitBucket;
      createQuick: RateLimitBucket;
    };
  };
  cache: {
    roleTtlMs: number;
  };
  squadScopedPermissions: boolean;
}

const DEFAULTS: Defaults = {
  rateLimits: {
    backup: {
      create: { count: 5, intervalMs: 60000 },
      restore: { count: 2, intervalMs: 60000 },
      createQuick: { count: 5, intervalMs: 60000 },
    },
  },
  cache: {
    roleTtlMs: 60000,
  },
  squadScopedPermissions: true,
};

function getNestedValue(obj: unknown, path: string[]): unknown {
  return path.reduce<unknown>((current, key) => {
    if (current && typeof current === 'object' && key in (current as Record<string, unknown>)) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function getConfig<T>(path: string[], defaultValue: T): T {
  const settingsValue = getNestedValue(Meteor.settings, path);
  if (settingsValue !== undefined) {
    return settingsValue as T;
  }
  const defaultsValue = getNestedValue(DEFAULTS, path);
  return (defaultsValue !== undefined ? defaultsValue : defaultValue) as T;
}

interface RateLimitsConfig {
  backup: {
    create: RateLimitBucket;
    restore: RateLimitBucket;
    createQuick: RateLimitBucket;
  };
}

export const RATE_LIMITS: RateLimitsConfig = {
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

export const CACHE: { readonly roleTtlMs: number } = {
  get roleTtlMs() {
    return getConfig(['cache', 'roleTtlMs'], 60000);
  },
};

export const SQUAD_SCOPED_PERMISSIONS: { readonly enabled: boolean } = {
  get enabled() {
    return getConfig(['squadScopedPermissions'], true);
  },
};
