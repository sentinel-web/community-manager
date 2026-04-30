import assert from 'node:assert';
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import type { Mongo } from 'meteor/mongo';
import RolesCollection from '../../imports/api/collections/roles.collection';
import LogsCollection from '../../imports/api/collections/logs.collection';
import { clearRoleCache } from '../../server/main';
import type { MemberProfile, Role } from '/imports/api/types';

// Fixture _ids start with this prefix so cleanupFixtures can scope a range
// query on the indexed _id field (IXSCAN, not COLLSCAN).
export const TEST_PREFIX = 'test_';
const TEST_PREFIX_END = 'test`'; // next char after '_' (0x5F) is '`' (0x60)
const prefixFilter = { _id: { $gte: TEST_PREFIX, $lt: TEST_PREFIX_END } };

function prefixedId(): string {
  return `${TEST_PREFIX}${Random.id()}`;
}

export async function createTestRole(permissions: Partial<Role> = {}): Promise<string> {
  const _id = prefixedId();
  await RolesCollection.insertAsync({ _id, name: `Test Role ${_id}`, ...permissions });
  return _id;
}

export interface CreateTestUserOptions {
  roleId?: string;
  profile?: Partial<MemberProfile>;
}

export async function createTestUser({ roleId, profile = {} }: CreateTestUserOptions = {}): Promise<string> {
  const _id = prefixedId();
  await Meteor.users.insertAsync({
    _id,
    username: _id,
    profile: { name: `Test ${_id}`, roleId, ...profile },
  });
  return _id;
}

// Loose generic so tests can pass any project collection without per-call casting.
export async function createTestDoc(
  Collection: Mongo.Collection<any>,
  data: Record<string, unknown> = {},
): Promise<string> {
  const _id = prefixedId();
  await Collection.insertAsync({ _id, ...data });
  return _id;
}

type MethodHandler = (this: { userId: string | null }, ...args: unknown[]) => unknown;

// Invokes a Meteor method handler directly with a synthetic `this.userId`
// context — bypasses DDP so tests don't need a logged-in connection.
export async function callAs(userId: string | null, methodName: string, ...args: unknown[]): Promise<unknown> {
  const handlers = (Meteor as unknown as { server: { method_handlers: Record<string, MethodHandler> } }).server.method_handlers;
  const handler = handlers[methodName];
  if (!handler) throw new Error(`Method "${methodName}" is not registered`);
  return handler.apply({ userId }, args);
}

export async function assertRejectsWithCode(fn: () => Promise<unknown>, code: number | string): Promise<void> {
  await assert.rejects(fn, (error: unknown) => (error as Meteor.Error).error === code);
}

interface AuditLog {
  action: string;
  payload: Record<string, unknown> & { id?: string };
  createdAt?: Date;
}

export async function findLatestAuditLog(action: string, payloadId: string): Promise<AuditLog | undefined> {
  return (await LogsCollection.findOneAsync(
    { action, 'payload.id': payloadId },
    { sort: { createdAt: -1 }, limit: 1 },
  )) as AuditLog | undefined;
}

// Removes fixture-created docs across users, roles, audit logs, and any
// extra collections the caller passes in. The `extraCollections` param
// keeps cleanup scoped — callers declare what they touched rather than
// wiping every collection defensively.
export async function cleanupFixtures(extraCollections: Mongo.Collection<any>[] = []): Promise<void> {
  await Promise.all([
    Meteor.users.removeAsync(prefixFilter),
    RolesCollection.removeAsync(prefixFilter),
    LogsCollection.removeAsync({ 'payload.id': { $gte: TEST_PREFIX, $lt: TEST_PREFIX_END } }),
    ...extraCollections.map(Collection => Collection.removeAsync(prefixFilter)),
  ]);
  clearRoleCache();
}
