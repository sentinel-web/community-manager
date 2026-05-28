import { Meteor } from 'meteor/meteor';
import { checkPermission, checkSpecialPermission } from './main';
import { createLog } from './apis/logs.server';
import { instrument } from './telemetry';

export type MutationOp = 'read' | 'create' | 'update' | 'delete';
export type AuditShape = 'insert' | 'update' | 'remove';

export interface MutationContext {
  readonly userId: string | null;
}

export interface MutationDescriptor<TArgs extends readonly unknown[], TResult> {
  readonly collection: string;
  readonly operation: MutationOp;
  readonly action?: string;
  readonly auditShape?: AuditShape;
  readonly audit?: (args: TArgs, result: TResult) => Record<string, unknown>;
  // Sensitive keys to strip from the standard audit payload before logging.
  // Shape-aware (see buildStandardPayload): stripped at the top level for
  // `insert`, and from within `changes`/`before` for `update`. Applied only to
  // standard auditShape paths; descriptor.audit functions own their redaction.
  readonly redact?: readonly string[];
  // Snapshot taken after validation/permission checks but BEFORE `body` runs,
  // so it can read the pre-mutation document. Its return is folded into the
  // standard `update` audit payload as `before`, giving logs a true
  // before→after diff. Returns undefined to omit (e.g. doc not found).
  readonly captureBefore?: (args: TArgs) => Promise<Record<string, unknown> | undefined>;
  readonly requireAuth?: boolean;
  readonly allowAnonymous?: boolean;
  readonly permissionModule?: string | null;
  readonly fallbackFlag?: string | null;
  // Conditional re-admit when the main permission check (and any unconditional
  // fallbackFlag) has denied the call. Receives the same ctx + args the body
  // will see, returns true to allow. The escape hatch for variations that
  // depend on the data being mutated (rule of three: stays as a callback
  // until 3+ collections need it).
  readonly permissionOverride?: (ctx: MutationContext, args: TArgs) => Promise<boolean>;
  readonly validate?: (args: TArgs) => void;
}

const OP_TO_DENIAL_SEGMENT: Record<MutationOp, string> = {
  create: 'insert',
  delete: 'remove',
  read: 'read',
  update: 'update',
};

function buildDenialAction<TArgs extends readonly unknown[], TResult>(
  descriptor: MutationDescriptor<TArgs, TResult>,
): string {
  return `${descriptor.collection}.${OP_TO_DENIAL_SEGMENT[descriptor.operation]}.denied`;
}

// Resolve a (possibly dotted) key against a document. Mirrors how the generic
// update accepts both nested objects (`{ profile: {...} }`) and dotted-path
// modifiers (`{ 'profile.specializationIds': [...] }`).
function getByPath(doc: Record<string, unknown>, path: string): unknown {
  if (!path.includes('.')) return doc[path];
  return path.split('.').reduce<unknown>((acc, seg) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return (acc as Record<string, unknown>)[seg];
  }, doc);
}

// Build the pre-mutation snapshot for an update, keyed identically to `changes`
// so the diff view can zip the two maps without path-matching. Each key in
// `changes` (plain or dotted) maps to its current value on `doc`.
export function snapshotTouchedFields(
  doc: Record<string, unknown>,
  changes: Record<string, unknown>,
): Record<string, unknown> {
  const before: Record<string, unknown> = {};
  for (const key of Object.keys(changes)) {
    before[key] = getByPath(doc, key);
  }
  return before;
}

function omitKeys(source: Record<string, unknown>, redactSet: Set<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (!redactSet.has(key)) out[key] = value;
  }
  return out;
}

function buildStandardPayload<TArgs extends readonly unknown[], TResult>(
  shape: AuditShape,
  args: TArgs,
  result: TResult,
  before: Record<string, unknown> | undefined,
  redact: readonly string[] | undefined,
): Record<string, unknown> {
  const redactSet = redact?.length ? new Set(redact) : undefined;
  switch (shape) {
    case 'insert': {
      const payload = (args[0] ?? {}) as Record<string, unknown>;
      const merged = { id: result as unknown as string, ...payload };
      return redactSet ? omitKeys(merged, redactSet) : merged;
    }
    case 'update': {
      const id = args[0] as string;
      const rawChanges = (args[1] ?? {}) as Record<string, unknown>;
      const changes = redactSet ? omitKeys(rawChanges, redactSet) : rawChanges;
      const payload: Record<string, unknown> = { id, changes };
      if (before) {
        const cleanBefore = redactSet ? omitKeys(before, redactSet) : before;
        if (Object.keys(cleanBefore).length > 0) payload.before = cleanBefore;
      }
      return payload;
    }
    case 'remove': {
      const id = args[0] as string;
      return { id };
    }
  }
}

function extractDenialId<TArgs extends readonly unknown[], TResult>(
  descriptor: MutationDescriptor<TArgs, TResult>,
  args: TArgs,
): string | undefined {
  // For ops where the first arg is the target id, surface it on `payload.id`
  // so denial entries are queryable by the same lookup pattern as success
  // entries (`findLatestAuditLog(action, payloadId)`).
  if (descriptor.operation === 'update' || descriptor.operation === 'delete') {
    const candidate = args[0];
    return typeof candidate === 'string' ? candidate : undefined;
  }
  return undefined;
}

async function emitDenial<TArgs extends readonly unknown[], TResult>(
  ctx: MutationContext,
  descriptor: MutationDescriptor<TArgs, TResult>,
  args: TArgs,
): Promise<void> {
  const action = buildDenialAction(descriptor);
  const id = extractDenialId(descriptor, args);
  const payload: Record<string, unknown> = { userId: ctx.userId };
  if (id !== undefined) payload.id = id;
  await createLog(action, payload);
}

export async function runMutation<TArgs extends readonly unknown[], TResult>(
  ctx: MutationContext,
  descriptor: MutationDescriptor<TArgs, TResult>,
  args: TArgs,
  body: (args: TArgs) => Promise<TResult>,
): Promise<TResult> {
  // Telemetry is purely additive: it times the call and classifies the
  // outcome, then re-throws any error untouched so return values and error
  // propagation are unchanged. `bodyStarted` flips once we get past every
  // pre-body gate (auth / permission / validation), letting us distinguish a
  // pre-body denial from a body error in the error path. The emit itself is
  // sync + fire-and-forget inside `instrument`, so the hot path isn't blocked.
  let bodyStarted = false;
  const method = `${descriptor.collection}.${OP_TO_DENIAL_SEGMENT[descriptor.operation]}`;

  return instrument(
    method,
    async () => {
      const requireAuth = descriptor.requireAuth ?? true;
      const isAnonymous = !ctx.userId;

      if (isAnonymous && requireAuth && !descriptor.allowAnonymous) {
        await emitDenial(ctx, descriptor, args);
        throw new Meteor.Error(401, 'Unauthorized');
      }

      if (!isAnonymous && descriptor.permissionModule) {
        const hasPermission = await checkPermission(ctx.userId, descriptor.permissionModule, descriptor.operation);
        if (!hasPermission) {
          const flag = descriptor.fallbackFlag;
          const hasSpecial = flag ? await checkSpecialPermission(ctx.userId, flag) : false;
          if (!hasSpecial) {
            const overrideAllowed = descriptor.permissionOverride
              ? await descriptor.permissionOverride(ctx, args)
              : false;
            if (!overrideAllowed) {
              await emitDenial(ctx, descriptor, args);
              throw new Meteor.Error(403, 'Permission denied');
            }
          }
        }
      }

      if (descriptor.validate) {
        try {
          descriptor.validate(args);
        } catch (error) {
          await emitDenial(ctx, descriptor, args);
          throw error;
        }
      }

      // Snapshot the pre-mutation state before the body mutates the document.
      const before = descriptor.captureBefore ? await descriptor.captureBefore(args) : undefined;

      // Past every gate — anything that throws from here on is a body error,
      // not a denial.
      bodyStarted = true;
      const result = await body(args);

      if (descriptor.action) {
        if (descriptor.audit) {
          await createLog(descriptor.action, descriptor.audit(args, result));
        } else if (descriptor.auditShape) {
          const payload = buildStandardPayload(descriptor.auditShape, args, result, before, descriptor.redact);
          await createLog(descriptor.action, payload);
        }
      }

      return result;
    },
    () => (bodyStarted ? 'error' : 'denied'),
  );
}
