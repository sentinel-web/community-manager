import { Meteor } from 'meteor/meteor';
import { checkPermission, checkSpecialPermission } from './main';
import { createLog } from './apis/logs.server';

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
  // Top-level keys to strip from the standard audit payload before logging.
  // Applied only to standard auditShape paths; descriptor.audit functions own
  // their own redaction.
  readonly redact?: readonly string[];
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

function buildStandardPayload<TArgs extends readonly unknown[], TResult>(
  shape: AuditShape,
  args: TArgs,
  result: TResult,
): Record<string, unknown> {
  switch (shape) {
    case 'insert': {
      const payload = (args[0] ?? {}) as Record<string, unknown>;
      return { id: result as unknown as string, ...payload };
    }
    case 'update': {
      const id = args[0] as string;
      const changes = (args[1] ?? {}) as Record<string, unknown>;
      return { id, changes };
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

  const result = await body(args);

  if (descriptor.action) {
    if (descriptor.audit) {
      await createLog(descriptor.action, descriptor.audit(args, result));
    } else if (descriptor.auditShape) {
      let payload = buildStandardPayload(descriptor.auditShape, args, result);
      if (descriptor.redact?.length) {
        const redactSet = new Set(descriptor.redact);
        const redacted: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(payload)) {
          if (!redactSet.has(key)) redacted[key] = value;
        }
        payload = redacted;
      }
      await createLog(descriptor.action, payload);
    }
  }

  return result;
}
