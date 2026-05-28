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
  telemetry: {
    enabled: boolean;
    // OTLP/HTTP endpoint for the self-hosted collector (decision O-3). Empty
    // string => use the default console exporter (no network).
    otlpEndpoint: string;
  };
  logs: {
    // Retention window for audit logs in seconds. Drives a MongoDB TTL index on
    // the log timestamp field. 0 disables expiry (keep forever).
    retentionSeconds: number;
  };
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
  telemetry: {
    enabled: true,
    otlpEndpoint: '',
  },
  logs: {
    // 90 days. Configurable via Meteor.settings; set to 0 to retain forever.
    retentionSeconds: 90 * 24 * 60 * 60,
  },
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

export const TELEMETRY: { readonly enabled: boolean; readonly otlpEndpoint: string } = {
  get enabled() {
    return getConfig(['telemetry', 'enabled'], true);
  },
  get otlpEndpoint() {
    return getConfig(['telemetry', 'otlpEndpoint'], '');
  },
};

export const LOGS: { readonly retentionSeconds: number } = {
  get retentionSeconds() {
    return getConfig(['logs', 'retentionSeconds'], 90 * 24 * 60 * 60);
  },
};
